console.log("here is my job");


console.log("creating an array");
var num = [];
for(var i = 0;i < 100;++i) {
    num[i] = i;
}
console.log("reducing to 1 sum");
var sum = num.reduce(function(sum, n) {
    return sum + n;
});

console.log(sum);
