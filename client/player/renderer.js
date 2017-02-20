'use strict';

const host = window.localStorage.getItem('host');
const port = parseInt(window.localStorage.getItem('port'), 10);
if(!host || !port) window.location.href = '../index.html';

const canvas = window.document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const net = require('net');
let source = JSON.parse(window.localStorage.getItem('source') || '{"webcam": true}');
let brightness = parseFloat(window.localStorage.getItem('brightness') || 0.3);
let fit = !!(window.localStorage.getItem('fit') || false);
let overlay = window.localStorage.getItem('overlay') || 'none';
let overlayLabel = window.localStorage.getItem('overlayLabel') || '';
let overlaySize = parseInt(window.localStorage.getItem('overlaySize') || 15, 10);
let overlayColor = window.localStorage.getItem('overlayColor') || '#000000';
const history = JSON.parse(window.localStorage.getItem('history') || '[]');
ctx.imageSmoothingEnabled = false;

/* Clock helper */
const clock = () => {
  const now = new Date();
  const trailingZero = n => ((n < 10 ? '0' : '') + n);
  return `${trailingZero(now.getHours())}:${trailingZero(now.getMinutes())}:${trailingZero(now.getSeconds())}`;
};

/* Sends a frame to the server */
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

/* Animation loop */
const animate = () => {
  if (!source) {
    setImmediate(animate);
    return;
  }

  /* Calculate frame dimensions */
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

  /* Render frame */
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source.frame, 0, 0, source.width, source.height, canvas.width / 2 - width / 2, canvas.height / 2 - height / 2, width, height);

  /* Render overlay (if any) */
  if (overlay !== 'none') {
    const text = overlay === 'clock' ? clock() : overlayLabel;
    const font = "'Lucida Console'";
    const size = overlaySize;
    const weight = 700;
    ctx.font = `${weight} ${size}px ${font}`;
    ctx.textAlign = 'center';
    const textWidth = ctx.measureText(text).width;
    const x = Math.round(canvas.width * 0.5);
    const y = Math.round(canvas.height * 0.5 + size * 0.35);
    ctx.fillStyle = overlayColor;
    ctx.fillText(text, x, y);
  }

  /* Post-processing */
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

/* Input handling */
const form = window.document.getElementsByTagName('form')[0];
form.onsubmit = (e) => e.preventDefault();
const inputs = window.document.getElementsByTagName('input');
for(let i=0; i<inputs.length; i++) {
  const input = inputs[i];
  if(input.name === 'type') {
    input.onchange = (e) => {
      const type = e.target.value;
      form.url.disabled = type === 'webcam';
      form.url.value = '';
      if (type === 'webcam') load({webcam: true});
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
  if(input.name === 'brightness') {
    input.value = brightness;
    input.onchange = (e) => {
      brightness = parseFloat(e.target.value);
      window.localStorage.setItem('brightness', brightness);
    };
  }
  if(input.name === 'url') {
    input.onchange = (e) => {
      const source = {};
      source[form.type.value] = e.target.value;
      load(source);
    };
  }
  if(input.name === 'overlay') {
    input.checked = (input.value === overlay);
    input.onchange = (e) => {
      overlay = e.target.value;
      form.overlayLabel.disabled = overlay !== 'label';
      window.localStorage.setItem('overlay', overlay);
    };
  }
  if(input.name === 'overlayLabel') {
    input.disabled = overlay !== 'label';
    input.value = overlayLabel;
    input.onchange = (e) => {
      overlayLabel = e.target.value;
      window.localStorage.setItem('overlayLabel', overlayLabel);
    };
  }
  if(input.name === 'overlaySize') {
    input.value = overlaySize;
    input.onchange = (e) => {
      overlaySize = e.target.value;
      window.localStorage.setItem('overlaySize', overlaySize);
    };
  }
  if(input.name === 'overlayColor') {
    input.value = overlayColor;
    input.onchange = (e) => {
      overlayColor = e.target.value;
      window.localStorage.setItem('overlayColor', overlayColor);
    };
  }
}

/* History render helper */
const renderHistory = (active) => {
  const ul = window.document.getElementsByTagName('ul')[0];
  while(ul.firstChild) ul.removeChild(ul.firstChild);
  history.forEach((src) => {
    const li = window.document.createElement('li');
    const parsed = JSON.parse(src);
    const file = (parsed.gif || parsed.video);
    const slash = file.lastIndexOf('/');
    li.innerText = ~slash ? file.substr(slash + 1) : file;
    if(active === src) {
      li.className = 'active';
    } else {
      li.onclick = () => {
        load(JSON.parse(src));
      };
    }
    ul.appendChild(li);
  });
};

const load = (src) => {
  if (source) {
    if (source.unload) source.unload();
    source = null;
  }
  const strSrc = JSON.stringify(src);
  if (!src.webcam && !(~history.indexOf(strSrc))) {
    history.unshift(strSrc);
    window.localStorage.setItem('history', JSON.stringify(history));
  }
  window.localStorage.setItem('source', strSrc);
  renderHistory(strSrc);
  if (src.webcam || src.video) {
    const video = window.document.createElement('video');
    video.onloadedmetadata = (e) => {
      video.onloadedmetadata = null;
      video.onplaying = () => {
        video.onplaying = null;
        source = {
          frame: video,
          width: video.videoWidth,
          height: video.videoHeight,
          unload: () => {
            video.pause();
            video.src = '';
          }
        };
      };
      video.play();
    };
    if (src.webcam) {
      navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          width: { min: 1280 },
          height: { min: 720 }
        }
      })
      .then((stream) => {
        video.srcObject = stream;
      })
      .catch((err) => {
        console.log(err.name + ": " + err.message);
      });
      form.type.value = 'webcam';
      form.url.value = '';
      form.url.disabled = true;
    } else if(src.video) {
      video.src = src.video;
      form.type.value = 'video';
      form.url.value = src.video;
      form.url.disabled = false;
    }
  } else if(src.gif) {
    const img = window.document.createElement('img');
    img.src = src.gif;
    const gif = new window.SuperGif({ gif: img });
    gif.load(() => {
      const player = gif.get_canvas();
      source = {
        frame: player,
        width: player.width,
        height: player.height,
        unload: () => {
          gif.pause();
        }
      };
    });
    form.type.value = 'gif';
    form.url.value = src.gif;
    form.url.disabled = false;
  } else {
    console.log('Invalid source');
  }
};

/* Kickstart the player */
load(source);
animate();
