var fs = require('fs');
var os = require('os');

console.log("I am job.js")
console.log("running on "+os.hostname());

console.log("creating an array");
var num = [];
for(var i = 0;i < 100;++i) {
    num[i] = i;
}
console.log("reducing to 1 sum");
var sum = num.reduce(function(sum, n) {
    return sum + n;
});

fs.writeFile('output.txt', sum, function (err) {
    if (err) throw err;
});

console.error("outputing something to stderr because I am bored");

//simulate some job
setTimeout(function() {
    console.log("job ended");
}, 1000*10);
