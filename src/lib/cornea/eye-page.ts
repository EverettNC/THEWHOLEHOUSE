/** Top-level eye: camera + cornea. Injected into about:blank so it never hits a second host. */
export function eyePageHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Lucent — live sight</title>
<style>
  html,body{margin:0;height:100%;background:#09090b;color:#ececec;font:15px/1.4 "IBM Plex Sans","Segoe UI",system-ui,sans-serif;overflow:hidden}
  body{display:flex;flex-direction:column}
  #stage{position:relative;flex:1;min-height:0;background:#09090b}
  #retina,#eye{position:absolute;inset:0;width:100%;height:100%}
  #eye{opacity:0;pointer-events:none}
  #retina{object-fit:contain}
  .label{position:absolute;top:14px;left:16px;margin:0;font:11px/1.2 ui-monospace,Menlo,monospace;letter-spacing:.08em;color:rgba(236,236,236,.72)}
  .bar{display:flex;align-items:center;gap:12px;padding:12px 16px;background:#09090b}
  .bar p{margin:0;flex:1;font-size:12px;color:#8b9196}
  button{height:40px;padding:0 14px;border:0;border-radius:8px;background:#c5d0d4;color:#09090b;font:500 13px/1 "IBM Plex Sans",system-ui,sans-serif;cursor:pointer}
  button.ghost{background:transparent;color:#ececec;box-shadow:inset 0 0 0 1px #2a2d33}
  button[hidden]{display:none}
</style>
</head>
<body>
<div id="stage">
  <video id="eye" autoplay muted playsinline></video>
  <canvas id="retina"></canvas>
  <p class="label">YOUR SIGHT THROUGH CORNEA</p>
</div>
<div class="bar">
  <p id="status">Opening the eye…</p>
  <button id="flip" type="button" hidden>Flip</button>
  <button id="go" type="button" hidden>Allow camera</button>
</div>
<script>
(function () {
  var video = document.getElementById("eye");
  var canvas = document.getElementById("retina");
  var status = document.getElementById("status");
  var go = document.getElementById("go");
  var flip = document.getElementById("flip");
  var facing = "environment";
  var stream = null;
  var live = false;
  var q = -0.26;

  function tell(type, extra) {
    if (!window.opener || window.opener.closed) return;
    window.opener.postMessage(Object.assign({ channel: "lucent-see", type: type }, extra || {}), "*");
  }

  var gl = canvas.getContext("webgl", { premultipliedAlpha: false, alpha: false, antialias: false });
  var prog = null, uTex = null, uRes = null, uQ = null, tex = null, buf = null;
  if (gl) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, "attribute vec2 a;varying vec2 v;void main(){v=a*0.5+0.5;gl_Position=vec4(a,0.0,1.0);}"));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, [
      "precision highp float;",
      "uniform sampler2D u;",
      "uniform vec2 r;",
      "uniform float q;",
      "varying vec2 v;",
      "void main(){",
      "vec2 p=v*2.0-1.0;p.x*=r.x/max(r.y,1.0);",
      "float d=length(p);",
      "vec2 m=p*(1.0+q*d*d*0.42);",
      "vec2 uv=vec2(m.x/(r.x/max(r.y,1.0)),m.y)*0.5+0.5;",
      "if(uv.x<0.0||uv.x>1.0||uv.y<0.0||uv.y>1.0){gl_FragColor=vec4(0.035,0.035,0.043,1.0);return;}",
      "vec2 px=0.0018*(1.0+d);",
      "vec3 c=texture2D(u,uv).rgb;",
      "c.r=texture2D(u,uv+vec2(px.x,0.0)).r;",
      "c.b=texture2D(u,uv-vec2(px.x,0.0)).b;",
      "gl_FragColor=vec4(c,1.0);",
      "}"
    ].join("\\n")));
    gl.bindAttribLocation(prog, 0, "a");
    gl.linkProgram(prog);
    uTex = gl.getUniformLocation(prog, "u");
    uRes = gl.getUniformLocation(prog, "r");
    uQ = gl.getUniformLocation(prog, "q");
    buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  function size() {
    var w = canvas.clientWidth || window.innerWidth;
    var h = Math.max(2, (canvas.clientHeight || window.innerHeight) - 0);
    var stage = document.getElementById("stage");
    w = stage.clientWidth; h = stage.clientHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    var tw = Math.max(2, Math.floor(w * dpr)), th = Math.max(2, Math.floor(h * dpr));
    if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th; }
    return { tw: tw, th: th };
  }

  function draw() {
    var s = size();
    if (gl && prog && video.readyState >= 2 && video.videoWidth) {
      gl.viewport(0, 0, s.tw, s.th);
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, video); } catch (e) {}
      gl.uniform1i(uTex, 0);
      gl.uniform2f(uRes, s.tw, s.th);
      gl.uniform1f(uQ, q);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    } else {
      var ctx = canvas.getContext("2d");
      if (ctx && video.videoWidth) {
        ctx.fillStyle = "#09090b";
        ctx.fillRect(0, 0, s.tw, s.th);
        ctx.drawImage(video, 0, 0, s.tw, s.th);
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);

  var jpegBusy = false;
  function sendJpeg() {
    if (!live || !window.opener || window.opener.closed || jpegBusy || video.videoWidth < 2) return;
    jpegBusy = true;
    var c = document.createElement("canvas");
    var w = 640, h = Math.max(2, Math.round(640 * (video.videoHeight / video.videoWidth)));
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(video, 0, 0, w, h);
    c.toBlob(function (blob) {
      if (!blob) { jpegBusy = false; return; }
      blob.arrayBuffer().then(function (buf) {
        jpegBusy = false;
        if (!window.opener || window.opener.closed) return;
        window.opener.postMessage({ channel: "lucent-see", type: "jpeg", buf: buf, w: w, h: h }, "*", [buf]);
      }).catch(function () { jpegBusy = false; });
    }, "image/jpeg", 0.55);
  }

  async function openEye() {
    status.textContent = "Opening the eye…";
    go.hidden = true;
    try {
      var next;
      try {
        next = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } }
        });
      } catch (e1) {
        next = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); });
      stream = next;
      video.srcObject = next;
      await video.play().catch(function () {});
      live = true;
      flip.hidden = false;
      status.textContent = "Live through the cornea. Keep this window open — this preview cannot hold a camera.";
      tell("ready");
      if (!window.__lucentPump) {
        window.__lucentPump = true;
        setInterval(function () {
          sendJpeg();
          if (video.videoWidth > 1) {
            createImageBitmap(video).then(function (bmp) {
              if (!window.opener || window.opener.closed) { bmp.close(); return; }
              window.opener.postMessage({ channel: "lucent-see", type: "frame", bmp: bmp }, "*", [bmp]);
            }).catch(function () {});
          }
        }, 80);
      }
    } catch (err) {
      live = false;
      status.textContent = "Allow the camera in this window. That is the only place silicon can see.";
      go.hidden = false;
      tell("denied");
    }
  }

  go.addEventListener("click", function () { void openEye(); });
  flip.addEventListener("click", function () {
    facing = facing === "user" ? "environment" : "user";
    void openEye();
  });
  window.addEventListener("message", function (event) {
    if (event.source !== window.opener) return;
    if (!event.data || event.data.channel !== "lucent-see") return;
    if (event.data.type === "flip") {
      facing = event.data.facing === "user" ? "user" : "environment";
      void openEye();
    }
    if (event.data.type === "optics" && typeof event.data.q === "number") q = event.data.q;
  });
  window.addEventListener("beforeunload", function () { tell("closed"); });
  void openEye();
})();
</script>
</body>
</html>`;
}
