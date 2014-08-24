var fs = require('fs');

console.log("I am job.js")

fs.readdir("./", function(err, list) {
    console.dir(list);
});

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


