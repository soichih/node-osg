var htcondor = require('htcondor');
var Promise = require('promise');
var tmp = require('tmp');
var async = require('async');
var which = require('which');
var extend = require('util')._extend;

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

var osg_options = {};
exports.init = function(options, callback) {
    osg_options = options;

    //nothing to initialize yet
    callback();
}

exports.submit = function(options, callbacks) {
    //initialize
    async.parallel([
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
        //create tmp stdout
        function(next) {
            if(options.stdout) {
                next();
            } else {
                tmp.file({keep: true}, function(err, path) { options.stdout = path; next();});
            }
        },
        //create tmp stderr
        function(next) {
            if(options.stderr) {
                next();
            } else {
                tmp.file({keep: true}, function(err, path) { options.stderr = path; next();});
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

        //override raw condor submit options
        if(osg_options.condor) {
            submit_options = extend(submit_options, osg_options.condor);
        }
        //console.dir(submit_options);

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
                    }
                    break;
                case "ExecuteEvent":
                    if(callbacks.execute) {
                        callbacks.execute(job, event);
                    }
                    break;
                case "JobImageSizeEvent":
                    if(callbacks.image_size) {
                        callbacks.image_size(job, event);
                    }
                    break; 
                case "ShadowExceptionEvent":
                    if(callbacks.execption) {
                        callbacks.exception(job, event);
                    }
                    break;
                case "JobHeldEvent":
                    if(callbacks.held) {
                        callbacks.held(job, event);
                        joblog.unwatch();
                    }
                    break;
                case "JobTerminatedEvent":
                    if(callbacks.terminated) {
                        callbacks.terminated(job, event);
                        joblog.unwatch();
                    }
                    break;
                default:
                    console.log("unknown event type:"+event.MyType);
                    console.dir(event);
                }
            });
        }).done(function(err) {
            if(err) throw err;
        });
    });
}

