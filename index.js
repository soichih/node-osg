var htcondor = require('htcondor');
var Promise = require('promise');
var tmp = require('tmp');
var async = require('async');
var which = require('which');
var clone = require('clone');

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
    submit: function(call) {this.callbacks.submit.push(call); return this;},
    call_submit: function(res) {
        this.callbacks.submit.forEach(function(call) {
            call(res);
        });
    },

    progress: function(call) {this.callbacks.progress.push(call); return this;},
    call_progress: function(res) {
        this.callbacks.progress.forEach(function(call) {
            call(res);
        });
    },

    success: function(call) {this.callbacks.success.push(call); return this;},
    call_success: function(res) {
        this.callbacks.success.forEach(function(call) {
            call(res);
        });
    },

    failed: function(call) {this.callbacks.failed.push(call); return this;},
    call_failed: function(res) {
        this.callbacks.failed.forEach(function(call) {
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

exports.submit = function(options) {
    var job = new Job();
    job.options = options;

    //initialize
    async.parallel([
        //send git executable
        function(next) {
            which('git', function(err, path) {
                if(err) {
                    console.log("can't find git. please install it on the submit host");
                } else {
                    options.input.push(path);
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
        htcondor.submit({
            universe: "vanilla",
            //universe: "local",

            executable: __dirname+"/wn/boot.sh",
            arguments: options.run,
            notification: "never",

            shouldtransferfiles: "yes",
            when_to_transfer_output: "ON_EXIT",
            transfer_input_files: options.input,
            output: options.stdout,
            error: options.stderr,

            "+ProjectName": "CSIU",
            queue: 1
        }).then(function(joblog) {
            var submit_event = clone(joblog.props);

            //a bit of fake to be props from xml joblog..
            console.log(joblog.jobid);
            var jobid = joblog.jobid.split(".");
            submit_event.Cluster = parseInt(jobid[0]);
            submit_event.Proc = parseInt(jobid[1]);
            //submit_event.MyType = "SubmitEvent"; //MyType is seto to "Job"..
            
            //we miss submit event because then() will be excuted *after* the job is submitted
            //so, just to be more consistent, I fire submit_event just in case
            job.call_submit(submit_event);

            //subscribe to joblog event
            joblog.event(function(event) {
                switch(event.MyType) {
                /* - I will never receive this - we are bit too late.. we will use joblog.props instead
                case "SubmitEvent":
                    job.call_submit(event);
                    break;
                */
                case "ExecuteEvent":
                    job.call_progress(event);
                    break;
                case "JobImageSizeEvent":
                    job.call_progress(event);
                    break;
                case "JobTerminatedEvent":
                    if(event.ReturnValue == 0) {
                        job.call_success(event);
                    } else {
                        job.call_failed(event);
                    }
                    joblog.unwatch();
                    break;
                default:
                    console.log("unknown event type:"+event.MyType);
                    console.dir(event);
                }
            });
            //job.call_progress(props);
        }).done(function(err) {
            if(err) throw err;
        });
    });
    return job;
}

