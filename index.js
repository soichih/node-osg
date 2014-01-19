var extend = require('util')._extend;
var fs = require('fs');
var path = require('path');

var htcondor = require('htcondor');
var Promise = require('promise');
var tmp = require('tmp');
var async = require('async');
var which = require('which');

/*
var Job = function() {
    this.callbacks =  {
        submit: [],
        progress: [],
        success: [],
        failed: [],
        evicted: [],
    }
};
Job.prototype = {
    started: function(call) {this.callbacks.submit.push(call); return this;},
    call_started: function(res) {
        this.callbacks.started.forEach(function(call) {
            call(res);
        });
    },

    progress: function(call) {this.callbacks.progress.push(call); return this;},
    call_progress: function(res) {
        this.callbacks.progress.forEach(function(call) {
            call(res);
        });
    },

    stopped: function(call) {this.callbacks.stopped.push(call); return this;},
    call_stopped: function(res) {
        this.callbacks.stopped.forEach(function(call) {
            call(res);
        });
    },

    ///////////////////////////////////////////////////////////////////////////
    //
    // other less common event handler..
    //
    submitted: function(call) {this.callbacks.submitted.push(call); return this;},
    call_submitted: function(res) {
        this.callbacks.submitted.forEach(function(call) {
            call(res);
        });
    },


    failed: function(call) {this.callbacks.failed.push(call); return this;},
    call_failed: function(res) {
        this.callbacks.failed.forEach(function(call) {
            call(res);
        });
    },

    held: function(call) {this.callbacks.held.push(call); return this;},
    call_held: function(res) {
        this.callbacks.held.forEach(function(call) {
            call(res);
        });
    },

    evicted: function(call) {this.callbacks.evicted.push(call); return this;},
    call_evicted: function(res) {
        this.callbacks.evicted.forEach(function(call) {
            call(res);
        });
    },
};
*/

var osg_options = {
    env: {}
};
exports.init = function(options, callback) {
    osg_options = extend(osg_options, options);

    //nothing to initialize yet
    callback();
}

exports.submit = function(options, callbacks) {
    options = extend({
        env: {}
    }, options);

    //initialize
    async.parallel([
        /*
        //send git executable
        function(next) {
            which('git', function(err, path) {
                if(err) {
                    console.log("can't find git. please install it on the submit host");
                } else {
                    options.send.push(path);
                    next();
                }
            });
        },
        */
        //create options.json
        function(next) {
            tmp.file({keep: false, postfix: '.json'}, function(err, tmppath, fd) { 
                if(err) throw err;
                fs.write(fd, JSON.stringify(options));
                options.run = path.basename(tmppath) + " " +options.run; //prepend env.json
                options.send.push(tmppath);
                next();
            });
        },
        //create tmp stdout
        function(next) {
            if(options.stdout) {
                next();
            } else {
                tmp.file({keep: false}, function(err, path) { 
                    if(err) throw err;
                    options.stdout = path; next();
                });
            }
        },
        //create tmp stderr
        function(next) {
            if(options.stderr) {
                next();
            } else {
                tmp.file({keep: false}, function(err, path) { 
                    if(err) throw err;
                    options.stderr = path; next();
                });
            }
        }
    ], function() {
        var submit_options = {
            universe: "vanilla",

            executable: __dirname+"/wn/boot.sh",
            arguments: options.run,
            notification: "never",

            shouldtransferfiles: "yes",
            when_to_transfer_output: "ON_EXIT",
            transfer_input_files: options.send,
            transfer_output_files: options.receive,
            output: options.stdout,
            error: options.stderr,
            queue: 1
        };

        //override with user submitted raw condor submit options
        if(osg_options.submit) {
            submit_options = extend(submit_options, osg_options.submit);
        }

        htcondor.submit(submit_options).then(function(job) {
            var joblog = job.log;
            var jobopts = job.options;
            var submit_event = extend({}, joblog.props);

            //a bit of fake to be props from xml joblog..
            //console.log(joblog.jobid);
            var jobid = joblog.jobid.split(".");
            submit_event.Cluster = parseInt(jobid[0]);
            submit_event.Proc = parseInt(jobid[1]);
            //submit_event.MyType = "SubmitEvent"; //MyType is seto to "Job"..
            
            //we miss submit event because then() will be excuted *after* the job is submitted
            //so, just to be more consistent, I fire submit_event just in case
            callbacks.submit(job, submit_event);

            //subscribe to joblog event
            joblog.event(function(event) {
                switch(event.MyType) {
                case "SubmitEvent":
                    if(callbacks.submit) {
                        callbacks.submit(job, event);
                        return;
                    }
                    break;
                case "ExecuteEvent":
                    if(callbacks.execute) {
                        callbacks.execute(job, event);
                        return;
                    }
                    break;
                case "JobImageSizeEvent":
                    if(callbacks.image_size) {
                        callbacks.image_size(job, event);
                        return;
                    }
                    break; 
                case "ShadowExceptionEvent":
                    if(callbacks.execption) {
                        callbacks.exception(job, event);
                        return;
                    }
                    break;
                case "JobHeldEvent":
                    if(callbacks.held) {
                        callbacks.held(job, event);
                        joblog.unwatch();
                        return;
                    }
                    break;
                case "JobTerminatedEvent":
                    if(callbacks.terminated) {
                        callbacks.terminated(job, event);
                        joblog.unwatch();
                        return;
                    }
                    break;
                default:
                    console.log("unknown event type:"+event.MyType);
                }
                //dump event if it's not handled (should I?)
                console.dir(event);
            });
        }).done(function(err) {
            if(err) throw err;
        });
    });
}

