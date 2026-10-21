'use strict';

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function difference(a, b) {
  const setB = new Set(b);
  return a.filter((item) => !setB.has(item));
}

function intersection(a, b) {
  const setB = new Set(b);
  return a.filter((item) => setB.has(item));
}

function debounce(fn, wait) {
  let timer;
  const debounced = function () {
    const args = arguments;
    const context = this;
    clearTimeout(timer);
    timer = setTimeout(function () {
      fn.apply(context, args);
    }, wait || 0);
  };
  debounced.cancel = function () {
    clearTimeout(timer);
  };
  return debounced;
}

module.exports = { chunk, difference, intersection, debounce };
module.exports.chunk = chunk;
module.exports.difference = difference;
module.exports.intersection = intersection;
module.exports.debounce = debounce;
module.exports.default = module.exports;
