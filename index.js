var extend = require('util')._extend;
var fs = require('fs');
var path = require('path');

var htcondor = require('htcondor');
var temp = require('temp');
var async = require('async');
var which = require('which');

//temp.track();

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

    options.send.push(__dirname+"/wn/osg");

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
        //package.json
        function(next) {
            options.send.push("package.json");
            next();
        },
        //create tmp options.json (used to send options to wn)
        function(next) {
            temp.open("osg-options.", function(err, ojson) { 
                if(err) throw err;
                fs.write(ojson.fd, JSON.stringify(options));
                options.run = "boot "+path.basename(ojson.path)+" "+options.run;
                options.send.push(ojson.path);
                next();
            });
        },
        //create tmp stdout
        function(next) {
            if(options.stdout) {
                //user specified
                next();
            } else {
                //creat temp one
                temp.open("osg-stdout.", function(err, tmp) { 
                    if(err) throw err;
                    options.stdout = tmp.path; 
                    next();
                });
            }
        },
        //create tmp stderr
        function(next) {
            if(options.stderr) {
                next();
            } else {
                temp.open('osg-stderr.', function(err, tmp) { 
                    if(err) throw err;
                    options.stderr = tmp.path; 
                    next();
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

            /*
            var jobopts = job.options;

            var submit_event = extend({}, joblog.props);

            //a bit of fake to be props from xml joblog..
            //console.log(joblog.jobid);
            //var jobid = joblog.jobid.split(".");
            submit_event.Proc = parseInt(job.id.proc);
            submit_event.Cluster = parseInt(job.id.cluster);
            //submit_event.MyType = "SubmitEvent"; //MyType is seto to "Job"..
            
            //we miss submit event because then() will be excuted *after* the job is submitted
            //so, just to be more consistent, I fire submit_event just in case
            if(callbacks.submit) {
                callbacks.submit(job, submit_event);
            }
            */

            //subscribe to joblog event
            joblog.watch(function(event) {
                var callback = undefined;

                //find callback to call
                switch(event.MyType) {
                case "GlobusSubmitEvent":
                case "GridSubmitEvent":
                case "SubmitEvent":
                    callback = callbacks.submit; break;
                case "ExecuteEvent":
                    callback = callbacks.execute; break;
                case "JobImageSizeEvent":
                    callback = callbacks.progress; break; 
                case "ShadowExceptionEvent":
                    callback = callbacks.exception; break;
                case "JobHeldEvent":
                    callback = callbacks.held; break;
                case "JobAbortedEvent":
                    callback = callbacks.aborted; break;
                case "JobTerminatedEvent":
                    callback = callbacks.terminated; break;
                case "JobEvictedEvent":
                    callback = callbacks.evicted; break;
                case "JobReleaseEvent":
                    callback = callbacks.released; break;
                case "JobDisconnectedEvent":
                    callback = callbacks.disconnected; break;
                default:
                    console.log("unknown event type:"+event.MyType);
                }

                if(callback) {
                    callback(job, event);
                } else {
                    //dump event if it's not handled (should I?)
                    console.dir(event);
                }
            });
        }).done(function(err) {
            if(err) throw err;
        });
    });
}

//just wrappers around htcondor.
exports.remove = function(job, callback) {
    htcondor.remove(job, callback);
}
exports.hold = function(job, callback) {
    htcondor.hold(job, callback);
}
exports.release = function(job, callback) {
    htcondor.release(job, callback);
}

