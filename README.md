node-osg
========

Open Science Grid client in nodejs. It's mainly a wrapper around htcondor and makes it easier to submit / monitor jobs in OSG environment by providing functionalities often used by jobs submitted to Open Science Grid.

As this is a node client, node executable will be automatically shipped to the remote cluster, but you can run non-javascript code at the worker node. You can use node-osg as a submission / dynamic workflow management tool. 

## Submit job and monitor events

```
var osg = require('node-osg');
var fs = require('fs');

osg.init({
    //only needed to run jobs on osg-xsede
    condor: { "+ProjectName": "CSIU" }
}, function() {
    //now it's ready to start submitting jobs
    osg.submit({
        send: ['job.js'],  
        //receive: ['output.txt'], //don't set this if you want receive all *files* (not directory) created in the wn/cwd.
        run: 'node job.js', //command to run
        
        //env parameters to pass to my job
        env: {name: "soichi"},
        
        timeout: 60*10 //kill job in 10 minutes (should take less than seconds to run)
    }, {
        submit: function(job, event) {
            console.log("job submitted");
            console.dir(event);
        },
        execute: function(job, event) {
            console.log("job executing");
            console.dir(event);
        },
        image_size: function(job, event) {
            console.log("image_size");
            console.dir(event);

            //you can monitor the job and remove / hold job from submission end.
            //job.log.unwatch(); //stop watcher for this job
            //osg.remove(job);

            //osg.hold(job);
        },
        exception: function(job, event) {
            console.log("exception");
            console.dir(event);
            job.log.unwatch(); //stop watcher for this job
        },
        held: function(job, event) {
            console.log("job held");
            //console.dir(job);
            console.dir(event);
            fs.readFile(job.options.output, 'utf8', function (err,data) {
                console.log(data);
            });
            fs.readFile(job.options.error, 'utf8', function (err,data) {
                console.log(data);
            });

            //if you want, you can release the job
            console.log("releasing job");
            osg.release(job);
        },
        evicted: function(job, event) {
            console.log("job evicted");
            console.dir(event);
            job.log.unwatch(); //stop watcher for this job
        },
        terminated: function(job, event) {
            console.log("job terminated");

            console.dir(job);
            console.dir(event);

            fs.readFile(job.options.output, 'utf8', function (err,data) {
                console.log(data);
            }); 

            fs.readFile(job.options.error, 'utf8', function (err,data) {
                console.log(data);
            }); 

            //analyze event.ReturnValue and decide what to do next (submit another job, etc..)

            job.log.unwatch(); //stop watcher for this job
        }
    });
});

```

job.js is just a test script that output stuff to console.log and console.error.

```
var fs = require('fs');

console.log("I am job.js")

console.log("creating an array");
var num = [];
for(var i = 0;i < 100;++i) {
    num[i] = i;
}
console.log("reducing to 1 sum");
var sum = num.reduce(function(sum, n) {
    return sum + n;
});

//output result
fs.writeFile('output.txt', sum, function (err) {
    if (err) throw err;
});

console.error("outputing something to stderr because I am bored");

//simulate some job
setTimeout(function() {
    console.log("job ended");
}, 1000*10);

```

Sample output

```
2014-01-16 19:54:09 UTC [hayashis@soichi6]$ node submit.js
submit path:/tmp/tmp-31624e9w1qo0.tmp
job submitted
{ MyType: 'SubmitEvent',
  SubmitHost: '<129.79.53.144:20862>',
  Proc: 0,
  Cluster: 379,
  EventTime: '2014-01-16T19:54:12',
  Subproc: 0,
  EventTypeNumber: 0,
  CurrentTime: 'expression:time()' }
job making progress
{ MyType: 'ExecuteEvent',
  Proc: 0,
  Cluster: 379,
  EventTime: '2014-01-16T19:54:15',
  ExecuteHost: '<129.79.53.144:22342>',
  Subproc: 0,
  EventTypeNumber: 1,
  CurrentTime: 'expression:time()' }
job making progress
{ MyType: 'JobImageSizeEvent',
  Size: 1,
  MemoryUsage: 0,
  Proc: 0,
  Cluster: 379,
  EventTime: '2014-01-16T19:54:15',
  Subproc: 0,
  EventTypeNumber: 6,
  CurrentTime: 'expression:time()',
  ResidentSetSize: 0 }
job fisnished successfully
{ MyType: 'JobTerminatedEvent',
  TotalLocalUsage: 'Usr 0 00:00:00, Sys 0 00:00:00',
  Proc: 0,
  EventTime: '2014-01-16T19:54:15',
  TotalRemoteUsage: 'Usr 0 00:00:00, Sys 0 00:00:00',
  TotalReceivedBytes: 10968307,
  ReturnValue: 0,
  RunRemoteUsage: 'Usr 0 00:00:00, Sys 0 00:00:00',
  RunLocalUsage: 'Usr 0 00:00:00, Sys 0 00:00:00',
  SentBytes: 190,
  Cluster: 379,
  TotalSentBytes: 190,
  Subproc: 0,
  CurrentTime: 'expression:time()',
  EventTypeNumber: 5,
  ReceivedBytes: 10968307,
  TerminatedNormally: false }
```

Please see /test directory for more sample codes
