var fs = require('fs');
var util = require('util');
var exec = require('child_process').exec;

console.log("I am job.js - starting timer")

setTimeout(function() {
    console.log("30 seconds reached");
    process.exit(0);
}, 30*1000);

var memory = [];
setInterval(function() {
    //use up memory
    for(var i = 0; i < 100000;i+=1) {
        memory.push(new Date());
    }
    console.log(process.memoryUsage());
}, 1000);



