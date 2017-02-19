/* Run timeouts inside the background process */
const ids = [];
exports.set = (callback, delay) => {
  const id = setTimeout(() => {
    ids.splice(ids.indexOf(id), 1);
    callback();
  }, delay);
  ids.push(id);
};
exports.reset = () => {
  ids.forEach(id => clearTimeout(id));
  ids.length = 0;
};
