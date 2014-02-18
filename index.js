var events = require('events');
var extend = require('util')._extend;
var fs = require('fs');
var path = require('path');

var htcondor = require('htcondor');
var temp = require('temp');
var async = require('async');
var which = require('which');

//remove submit file created
temp.track();

//keep track of which jobs are submitted (that we need to abort in case of SIGTERM/SIGINT)
var submitted = {};
exports.running = 0; //number of jobs currently running

/*
//some default osg options
var osg_options = {
    env: {}
};
*/

/*
exports.init = function(options, callback) {
    osg_options = extend(osg_options, options);

    //nothing to initialize yet
    callback();
}
*/

//callbacks are deprecated - use eventEmitter returned.
exports.submit = function(options) {

    var eventEmitter = new events.EventEmitter();

    //some default
    options = extend({
        something: 'hoge',
        receive: []
    }, options); 

    /*
    //turn relative path to absolute 
    options.send.forEach(function(send) {
        if(send[0] != "/") { //TODO is this 
        
        }
    });
    */

    //options.send.push(__dirname+"/wn/osg");
    //options.send.push(__dirname+"/wn/run.js");

    //always receive jobstats.csv
    //options.receive.push('jobstats.txt');

    //initialize
    async.series([
        //create rundir if not specified (and call prepare if specified)
        function(next) {
            if(!options.rundir) {
                //just create an empty rundir
                temp.mkdir('node-osg.rundir', function(err, rundir) { 
                    if(err) throw err;
                    options.rundir = rundir;
                });
            } else {
                //rundir specified.. but is it a function?
                if (typeof(options.rundir) == 'function') {
                    temp.mkdir('node-osg.rundir', function(err, rundir) { 
                        if(err) throw err;
                        //let user populate rundir
                        options.rundir(rundir, function() {
                            options.rundir = rundir;
                            next();
                        });
                    });
                }
            }
        },

        /*
        //symlink all relative input files to rundir
        function(next) {
            //console.log('start symlink');
            if(options.send) {
                var send_basenames = [];
                async.forEach(options.send, function(send, next_send) {
                    //if(send[0] != "/") {
                    //always resolve send path
                    var from = path.resolve(send);
                    send_basename = path.basename(send);
                    send_basenames.push(send_basename);
                    //console.log("symlinking from "+from+" to "+options.rundir+"/"+send_basename);
                    fs.symlink(from, options.rundir+"/"+send_basename, next_send);
                    //TODO check to see file actually exists?
                }, function() {
                    options.send = send_basenames;
                    next();
                });
            } else {
                next();
            }
        },
        */

        //create tmp options.json (used to send options to wn)
        function(next) {
            fs.open(options.rundir+"/options.json", 'w', function(err, fd) { 
                if(err) throw err;
                fs.write(fd, JSON.stringify(options));
                //options.run = path.basename(ojson.path)+" "+options.run;
                //options.send.push("options.json");
                fs.close(fd, next);
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
        },

        //list all files in rundir and send
        function(next) {
            fs.readdir(options.rundir, function(err, files) {
                options.send = [];
                files.forEach(function(file) {
                    //console.log("senging:"+ file);
                    options.send.push(file);
                });
                next();
            });
        }
    ], function() {
        //turn array arguments to a single string
        if(Array.isArray(options.arguments)) {
            options.arguments = options.arguments.join(" ");
        }

        //construct htcondor options
        //console.log('submitting');
        var submit_options = {
            universe: 'vanilla',

            //executable: __dirname+'/wn/boot.sh',
            //arguments: options.run,

            executable: options.executable,
            arguments: options.arguments,
            notification: 'never',

            initialdir: options.rundir,

            should_transfer_files: 'YES',
            when_to_transfer_output: 'ON_EXIT',
            transfer_input_files: options.send,
            transfer_output_files: options.receive,

            output: options.stdout,
            error: options.stderr,

            queue: 1
        };

        if(options.description) {
            submit_options["+Description"] = options.description;
        }

        //add some condor override
        submit_options = extend(submit_options, options.condor);
        htcondor.submit(submit_options).then(function(job) {

            eventEmitter.emit('submit', job, {});

            submitted[job.id] = job;
            job.log.onevent(function(event) {
                //find callback to call
                switch(event.MyType) {
                /* start events are most likely already posted to joblog, and Tail won't re-wide to receive them
                   so you will never receive these events
                case "GlobusSubmitEvent":
                case "GridSubmitEvent":
                case "SubmitEvent":
                    console.dir(event);
                    callback = callbacks.submit; 
                    break;
                */

                case "ExecuteEvent":
                    exports.running++;
                    if(options.timeout) {
                        job.timeout = setTimeout(function() {
                            /*
                            if(callbacks.timeout) {
                                callbacks.timeout(job);
                            } else {
                                //default behavior of timeout is to kill this job
                                console.log(job.id+" reached timeout of "+options.timeout+" msec. removing job");
                                exports.remove(job);
                            }
                            */
                            eventEmitter.emit('timeout', job);
                        }, options.timeout);
                    }
                    eventEmitter.emit('execute', job, {
                        _event: event
                    });
                    break;
                case "JobImageSizeEvent":
                    eventEmitter.emit('progress', job, {
                        Size: event.Size,
                        MemoryUsage: event.MemoryUsage,
                        ResidentSetSize: event.ResidentSetSize
                    });
                    break; 
                case "ShadowExceptionEvent":
                    exports.running--;
                    eventEmitter.emit('exception', job, {
                        Message: event.Message
                    });
                    break;
                case "JobHeldEvent":
                    exports.running--;
                    eventEmitter.emit('hold', job, {
                        _event: event
                    });
                    break;
                case "JobEvictedEvent": //TODO - is this terminal event?
                    exports.running--;
                    info = event; //TODO - pick thing we really care
                    eventEmitter.emit('evict', job, {
                        _event: event
                    });
                    break;
                case "JobReleaseEvent":
                    eventEmitter.emit('release', job, {
                        _event: event
                    });
                    break;
                case "JobDisconnectedEvent":
                    exports.running--;
                    eventEmitter.emit('disconnect', job, {
                        _event: event
                    });
                    break;
                case "JobReconnectFailedEvent":
                    exports.running--;
                    eventEmitter.emit('reconnectfail', job, {
                        _event: event
                    });
                    break;

                //terminal status
                case "JobAbortedEvent":
                    exports.running--;
                    cleanup(job);
                    eventEmitter.emit('abort', job, {
                        _event: event
                    });
                    break;
                case "JobTerminatedEvent":
                    exports.running--;
                    cleanup(job);
                    eventEmitter.emit('terminate', job, {
                        rundir: options.rundir,
                        ret: event.ReturnValue
                    });
                    break;
                default:
                    console.log("unknown event type:"+event.MyType);
                }
                /*

                //callbacks are deprecated - use eventEmitter
                if(callback) {
                    callback(job, info);
                } else {
                    //TODO - dump un-handled event if it's on debug
                    console.log("unhandled event");
                    console.dir(event);
                }
                */
            });
        }).done(function(err) {
            if(err) throw err;
        });
    });

    return eventEmitter;
}

//forget that this job ever existed
function cleanup(job) {
    //console.log("cleaning "+job.id);
    job.log.unwatch();
    if(job.timeout) {
        //console.log("stopping timeout for "+job.id);
        clearTimeout(job.timeout);
        delete job.timeout;//necessary?
    }
    delete submitted[job.id];
}

//just wrappers around htcondor.
exports.remove = function(job, callback) {
    console.log("removing job:"+job.id);
    cleanup(job);
    return htcondor.remove(job, callback);
}
exports.hold = function(job, callback) {
    return htcondor.hold(job, callback);
}
exports.release = function(job, callback) {
    return htcondor.release(job, callback);
}
exports.q = function(job, callback) {
    return htcondor.q(job, callback);
}

//abort any jobs that are still submitted
exports.removeall = function() {
    for(var id in submitted) {
        var job = submitted[id];
        exports.remove(job);
    }
}

process.on('SIGINT', function() {
    exports.removeall();
});

process.on('SIGTERM', function() {
    exports.removeall();
})
