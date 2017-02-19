'use strict';

const host = window.localStorage.getItem('host');
const port = parseInt(window.localStorage.getItem('port'), 10);
if(!host || !port) window.location.href = '../index.html';

const canvas = window.document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const net = require('net');
let source = JSON.parse(window.localStorage.getItem('source'));
let brightness = parseFloat(window.localStorage.getItem('brightness') || 0.3);
let fit = !!(window.localStorage.getItem('fit') || false);
const history = JSON.parse(window.localStorage.getItem('history') || '[]');
ctx.imageSmoothingEnabled = false;

const reload = () => {
  window.timeouts.reset();
  window.location.reload();
};

const send = (canvas, callback) => {
  const buffer = Buffer.from(canvas.toDataURL().substr(22), 'base64');
  const client = net.connect({
    host,
    port
  }, () => {
    client.write(Buffer.from([buffer.length & 0xFF, (buffer.length >> 8) & 0xFF]));
    client.write(buffer);
  });
  client.on('close', () => callback());
};

const animate = () => {
  const aspect = source.width / source.height;
  const diff = (canvas.width / canvas.height) < aspect;
  let width, height;
  if ((fit && !diff) || (!fit && diff)) {
    width = canvas.width;
    height = canvas.width / aspect;
  } else {
    width = canvas.height * aspect;
    height = canvas.height;
  }
  canvas.width = canvas.width;
  ctx.drawImage(source.image, 0, 0, source.width, source.height, canvas.width / 2 - width / 2, canvas.height / 2 - height / 2, width, height);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for(let i=0; i<imgData.data.length; i+=4) {
    imgData.data[i] = imgData.data[i] * brightness;
    imgData.data[i+1] = imgData.data[i+1] * brightness;
    imgData.data[i+2] = imgData.data[i+2] * brightness;
    imgData.data[i+3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);
  ctx.fillStyle = `rgba(0, 0, 0, ${1.0 - brightness})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  send(canvas, animate);
};

const form = window.document.getElementsByTagName('form')[0];
form.onsubmit = (e) => e.preventDefault();
const inputs = window.document.getElementsByTagName('input');
for(let i=0; i<inputs.length; i++) {
  const input = inputs[i];
  if(input.type === 'radio') {
    input.onchange = (e) => {
      const type = e.target.value;
      form.url.style.display = (type !== 'webcam') ? 'block' : 'none';
      form.url.value = '';
      window.localStorage.removeItem('source');
      if (type === 'webcam') reload();
    };
  }
  if(input.name === 'fit') {
    input.checked = fit;
    input.onchange = (e) => {
      fit = e.target.checked;
      if (fit) window.localStorage.setItem('fit', 1);
      else window.localStorage.removeItem('fit');
    };
  }
  if(input.name === 'url') {
    input.onchange = (e) => {
      const source = {};
      source[form.type.value] = e.target.value;
      window.localStorage.setItem('source', JSON.stringify(source));
      reload();
    };
  }
  if(input.name === 'brightness') {
    input.value = brightness;
    input.onchange = (e) => {
      brightness = parseFloat(e.target.value);
      window.localStorage.setItem('brightness', brightness);
    };
  }
}

const video = window.document.createElement('video');
video.onloadedmetadata = (e) => {
  video.onloadedmetadata = null;
  video.onplaying = () => {
    video.onplaying = null;
    source = {
      image: video,
      width: video.videoWidth,
      height: video.videoHeight
    };
    animate();
  };
  video.play();
};

const strSource = JSON.stringify(source);
if(source && !(~history.indexOf(strSource))) {
  history.unshift(JSON.stringify(source));
  window.localStorage.setItem('history', JSON.stringify(history));
}
const ul = window.document.getElementsByTagName('ul')[0];
history.forEach((src) => {
  const li = window.document.createElement('li');
  const parsed = JSON.parse(src);
  const file = (parsed.gif || parsed.video);
  const slash = file.lastIndexOf('/');
  li.innerText = ~slash ? file.substr(slash + 1) : file;
  if(strSource === src) {
    li.className = 'active';
  } else {
    li.onclick = () => {
      window.localStorage.setItem('source', src);
      reload();
    };
  }
  ul.appendChild(li);
});

if (source === null) {
  navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { min: 1280 },
      height: { min: 720 }
    }
  })
  .then(function(stream) {
    video.srcObject = stream;
  })
  .catch(function(err) {
    console.log(err.name + ": " + err.message);
  });
  form.type.value = 'webcam';
  form.url.style.display = 'none';
} else if(source.gif) {
  const img = window.document.createElement('img');
  img.src = source.gif;
  const gif = new window.SuperGif({ gif: img });
  gif.load(() => {
    const player = gif.get_canvas();
    source = {
      image: player,
      width: player.width,
      height: player.height
    };
    animate();
  });
  form.type.value = 'gif';
  form.url.value = source.gif;
} else if(source.video) {
  video.src = source.video;
  form.type.value = 'video';
  form.url.value = source.video;
} else {
  console.log('Invalid source');
}
