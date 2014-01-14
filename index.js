var htcondor = require('htcondor');
var Promise = require('promise');

function Instance() {
    var callbacks = {
        _progress: [],
        _success: [],
        _failed: [],
        _evicted: [],
    };
    return {
    progress: function(call) {callbacks._progress.push(call); return this;},
    success: function(call) {callbacks._success.push(call); return this;},
    failed: function(call) {callbacks._failed.push(call); return this;},
    evicted: function(call) {callbacks._evicted.push(call); return this;},
    }
};

exports.submit = function(job) {
    var instance = new Instance();
    htcondor.submit({
            universe: "vanilla",
            //universe: "local",

            executable: process.execPath,
            argument: job.run,
            //notification: "never",

            shouldtransferfiles: "yes",
            when_to_transfer_output: "ON_EXIT",
            input: job.input,
            output: job.output,
            error: "test.out",

            "+ProjectName": "CSIU",
            queue: 1
    }, function(props) {
        console.log("got prop");
        console.dir(props);
        instance._progress(props);
    });
    return instance;
}

