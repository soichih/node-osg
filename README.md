node-osg
========

Node OSG client

## Submit job and monitor events

```
var osg = require('node-osg');

var job = osg.submit({
    input: ['job.js'],
    run: './node job.js',
    stdout: 'stdout.txt',
    stderr: 'stderr.txt',
});
job.submit(function(p) {
    console.log("job submitted");
    console.dir(p);
}).progress(function(p) {
    console.log("job making progress");
    console.dir(p);
}).success(function(p) {
    console.log("job fisnished successfully");
    console.dir(p);
}).failed(function(p) {
    console.log("job failed");
    console.dir(p);
}).evicted(function() {
    console.log("job evicted");
    console.dir(p);
});
```

job.js is just a test script that output stuff to console.log and console.error.

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
