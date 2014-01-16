var htcondor = require('htcondor');
var Promise = require('promise');

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

    options.input.push(process.execPath);
    //options.input.push(__dirname+"/osg-submit.js");

    htcondor.submit({
        universe: "vanilla",
        //universe: "local",

        executable: __dirname+"/osg-submit.js",
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
        //subscribe to joblog event
        joblog.event(function(event) {
            switch(event.MyType) {
            case "SubmitEvent":
                job.call_submit(event);
                break;
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

    return job;
}

