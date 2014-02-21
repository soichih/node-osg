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

//list of all workflow created via this module (used to remove all jobs on all workflows)
var workflows = [];

var Job = function(workflow) {
    //public variables
    this.id = null; //jobid. set when job is submitted
    this.workflow = workflow; //parent workflow (not used yet?)
    //this._submit = null; //submit info from condor

    //private variables
    var eventEmitter = new events.EventEmitter();
    var joblog = null; //set when job is submitted

    //var timeout = null; //started when job gets executed, and stopped when job gets held,aborted,terminated

    //public functions 
    this.on = function(event, callback) {
        eventEmitter.on(event, callback);
    }
    this.emit = function(event, data) {
        eventEmitter.emit(event, data);
    }
    this.remove = function(callback) {
        console.log("removing job:"+this.id);
        this.workflow.cleanup(this);
        return htcondor.remove(this.id, callback);
    }
    this.hold = function(callback) {
        return htcondor.hold(this.id, callback);
    }
    this.release = function(callback) {
        return htcondor.release(this.id, callback);
    }
    this.q = function(callback) {
        return htcondor.q(this.id, callback);
    }
}
exports.Job = Job;

var Workflow = function() {
    this.submitted = {}; //jobs are submitted (that we need to abort in case of SIGTERM/SIGINT) by this workflow
    workflows.push(this); //register this workflow to module workflow list
}
exports.Workflow = Workflow;

Workflow.prototype.cleanup = function(job) {
    //console.log("cleaning "+job.id);
    if(job.timeout) {
        clearTimeout(job.timeout);
        delete job.timeout;
    }
    job.log.unwatch();
    delete this.submitted[job.id];
}

Workflow.prototype.submit = function(options) {
    var workflow = this;
    var job = new Job(this);

    //some default
    options = extend({
        something: 'hoge',
        send: [],
        receive: []
    }, options); 

    //initialize
    async.series([
        //create rundir if not specified (and call prepare if specified)
        function(next) {
            if(!options.rundir) {
                //just create an empty rundir
                temp.mkdir('node-osg.rundir', function(err, rundir) { 
                    if(err) throw err;
                    options.rundir = rundir;
                    next();
                });
            } else {
                //rundir specified by user.. but is it a function?
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

        /*
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
        */

        //create tmp stdout
        function(next) {
            if(options.stdout) {
                //user specified
                next();
            } else {
                /*
                //creat temp one
                temp.open({dir: options.rundir, prefix:"osg-stdout."}, function(err, tmp) { 
                    if(err) throw err;
                    console.log("using stdout path:"+tmp.path);
                    options.stdout = tmp.path; 
                    next();
                });
                */
                options.stdout = options.rundir+"/stdout.out";
                next();
            }
        },

        //create tmp stderr
        function(next) {
            if(options.stderr) {
                next();
            } else {
                /*
                temp.open('osg-stderr.', function(err, tmp) { 
                    if(err) throw err;
                    options.stderr = tmp.path; 
                    next();
                });
                */
                options.stderr = options.rundir+"/stderr.out";
                next();
            }
        },

        //list all files in rundir and send
        function(next) {
            fs.readdir(options.rundir, function(err, files) {
                options.send = [];
                files.forEach(function(file) {
                    options.send.push(file);
                });
                next();
            });
        }
    ], function() {
        var submit_options = {
            universe: 'vanilla',

            executable: options.executable,
            notification: 'never',

            initialdir: options.rundir,

            should_transfer_files: 'YES',
            when_to_transfer_output: 'ON_EXIT',

            output: options.stdout,
            error: options.stderr,

            queue: 1
        };


        if(options.receive.length > 0) {
            submit_options.transfer_output_files = options.receive;
        }

        if(options.send.length > 0) {
            submit_options.transfer_input_files = options.send;
        }

        if(options.arguments) {
            //turn array arguments to a single string
            if(Array.isArray(options.arguments)) {
                options.arguments = options.arguments.join(" ");
            }
            submit_options.arguments = options.arguments;
        }
        if(options.description) {
            submit_options["+Description"] = options.description;
        }
        if(options.debug) {
            submit_options.debug = options.debug;
        }

        //add some condor override
        submit_options = extend(submit_options, options.condor);

        job.rundir = options.rundir;
        job.stdout = options.stdout;
        job.stderr = options.stderr;

        //finally, submit to condor
        htcondor.submit(submit_options).then(function(condorjob) {
            //set info..
            job.id = condorjob.id;
            job.log = condorjob.log;
            //job._submit = condorjob; //set other things.. that might come in handy
            workflow.submitted[condorjob.id] = job;

            //console.log("htcondor submitted..calling onevent");
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

                //start status
                case "ExecuteEvent":
                    /*
                    { MyType: 'ExecuteEvent',
                      Proc: 0,
                      Cluster: 54627595,
                      EventTime: '2014-02-19T18:13:42',
                      ExecuteHost: '<192.41.230.230:60271?CCBID=129.79.53.179:9813#67680&noUDP>',
                      Subproc: 0,
                      EventTypeNumber: 1,
                      CurrentTime: 'expression:time()' }
                    */
                    if(options.timeout) {
                        if(job.timeout) {
                            console.log("this shouldn't happen, but timeout is already running on ExecutEvent.. clearing");
                            clearTimeout(job.timeout);
                        }
                        job.timeout = setTimeout(function() {
                            job.emit('timeout');
                            delete job.timeout; //necessary?
                        }, options.timeout);
                    }
                    job.emit('execute', {});
                    break;

                //transitional
                case "JobImageSizeEvent":
                    /*
                    { Size: 1,
                      MyType: 'JobImageSizeEvent',
                      MemoryUsage: 3,
                      Proc: 0,
                      Cluster: 54628985,
                      EventTime: '2014-02-19T18:17:31',
                      Subproc: 0,
                      EventTypeNumber: 6,
                      CurrentTime: 'expression:time()',
                      ResidentSetSize: 2744 }
                    */
                    var info = {
                        Size: event.Size,
                        MemoryUsage: event.MemoryUsage,
                        ResidentSetSize: event.ResidentSetSize
                    };
                    job.emit('imagesize', info);
                    job.emit('progress', info); //deprecated (use imagesize instead)
                    break; 
                case "ShadowExceptionEvent":
                    if(job.timeout) {
                        console.log("stopping timer due to exception thrown");
                        clearTimeout(job.timeout);
                        delete job.timeout;
                    }

                    job.emit('exception', {
                        Message: event.Message
                    });
                    break;

                case "JobReleaseEvent":
                    /*
                    { Reason: 'via condor_release (by user hayashis)',
                         MyType: 'JobReleaseEvent',
                         Proc: 0,
                         Cluster: 54627595,
                         EventTime: '2014-02-19T18:14:02',
                         Subproc: 0,
                         EventTypeNumber: 13,
                         CurrentTime: 'expression:time()' }
                    */
                    job.emit('release', {
                        Reason: event.Reason
                    });
                    break;

                case "JobDisconnectedEvent":
                    job.emit('disconnect', {
                        _event: event
                    });
                    break;

                case "JobReconnectFailedEvent":
                    job.emit('reconnectfail', {
                        _event: event
                    });
                    break;
                case "JobEvictedEvent": 
                    //called if someone call condor_hold 
                    //I am not sure if this fired when someone remove() job, but since we stop log.watch, we won't emit evict in any case
                    /*
                    { Proc: 0,
                         EventTime: '2014-02-20T01:27:36',
                         RunRemoteUsage: 'Usr 0 00:00:00, Sys 0 00:00:00',
                         RunLocalUsage: 'Usr 0 00:00:00, Sys 0 00:00:00',
                         SentBytes: 0,
                         MyType: 'JobEvictedEvent',
                         TerminatedAndRequeued: false,
                         Checkpointed: false,
                         Cluster: 54671750,
                         Subproc: 0,
                         CurrentTime: 'expression:time()',
                         EventTypeNumber: 4,
                         TerminatedNormally: false,
                         ReceivedBytes: 702 }
                    */

                    if(job.timeout) {
                        console.log("hold call back should handle timeout, so not sure if this is necessary, but... just in case");
                        clearTimeout(job.timeout);
                        delete job.timeout;
                    }

                    job.emit('evict', {
                        SentBytes: event.SentBytes,
                        TerminatedAndRequeued: event.TerminatedAndRequeued,
                        Checkpointed: event.Checkpointed,
                        TerminatedNormally: event.TerminatedNormally,
                        ReceivedBytes: event.ReceivedBytes
                    });
                    break;

                //pause status
                case "JobHeldEvent":
                    /*
                    <c>
                        <a n="HoldReasonCode"><i>1</i></a>
                        <a n="MyType"><s>JobHeldEvent</s></a>
                        <a n="Proc"><i>0</i></a>
                        <a n="Cluster"><i>54627270</i></a>
                        <a n="EventTime"><s>2014-02-19T18:06:34</s></a>
                        <a n="HoldReasonSubCode"><i>0</i></a>
                        <a n="Subproc"><i>0</i></a>
                        <a n="EventTypeNumber"><i>12</i></a>
                        <a n="HoldReason"><s>via condor_hold (by user hayashis)</s></a>
                        <a n="CurrentTime"><e>time()</e></a>
                    </c>
                    */
                    if(job.timeout) {
                        clearTimeout(job.timeout);
                        delete job.timeout;
                    }
                    job.emit('hold', {
                        HoldReasonCode: event.HoldReasonCode,
                        HoldReasonSubCode: event.HoldReasonSubCode,
                        HoldReason: event.HoldReason
                    });
                    break;

                //terminal status (need to stop timer and cleanup the job)
                case "JobAbortedEvent":
                    /*
                    { Reason: 'via condor_rm (by user hayashis)',
                      MyType: 'JobAbortedEvent',
                      Proc: 0,
                      Cluster: 54629517,
                      EventTime: '2014-02-19T18:18:23',
                      Subproc: 0,
                      EventTypeNumber: 9,
                      CurrentTime: 'expression:time()' }
                    */
                    workflow.cleanup(job);
                    job.emit('abort', {
                        Reason: event.Reason
                    });
                    break;
                case "JobTerminatedEvent":
                    workflow.cleanup(job);
                    job.emit('terminate', {
                        ret: event.ReturnValue
                    });
                    break;

                default:
                    console.log("unknown event type:"+event.MyType);
                }
            });

            //finally, notify our user of submit event
            //console.log("condor submitted");
            job.emit('submit', condorjob);
        }, function(err) {
            //htcondor.submit reject
            console.error("htcondor.submit failed");
            throw err;
        });
    });

    return job;
}

//abort any jobs that are still submitted
Workflow.prototype.removeall = function() {
    for(var id in this.submitted) {
        var job = this.submitted[id];
        job.remove();
    }
    this.submitted = [];
} 
    
//remove all jobs on all workflows
process.on('SIGINT', function() {
    workflows.forEach(function(workflow) {
        workflow.removeall();
    });
});
process.on('SIGTERM', function() {
    workflows.forEach(function(workflow) {
        workflow.removeall();
    });
});

