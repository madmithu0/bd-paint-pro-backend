const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || "*";

// helmet CSP HSTS
app.use(helmet({
  contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    scriptSrc: ["'self'"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", FRONTEND_URL],
    objectSrc: ["'none'"]
  }},
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));

// cors + json 10mb
app.use(cors({
  origin: FRONTEND_URL === "*" ? true : FRONTEND_URL.includes(',') ? FRONTEND_URL.split(',') : FRONTEND_URL,
  methods: ["GET","POST","PUT","DELETE","PATCH"],
  credentials: FRONTEND_URL !== "*"
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// sanitizeInput
function sanitizeInput(req,res,next){
  const clean = (o) => {
    if(!o || typeof o !== 'object') return;
    for(let k in o){
      if(k.includes('$') || k.includes('__proto__')){ delete o[k]; continue; }
      if(typeof o[k] === 'string') o[k]=o[k].replace(/[<>"'`]/g,'').trim();
      else if(typeof o[k] === 'object') clean(o[k]);
    }
  };
  if(req.body) clean(req.body);
  next();
}
app.use(sanitizeInput);

// rateLimiter
const hits = new Map();
setInterval(()=>{ let n=Date.now(); for(let [ip,v] of hits){ if(n-v.t>9e5) hits.delete(ip); } }, 6e5);
function rateLimiter(req,res,next){
  let ip=req.ip, now=Date.now();
  if(!hits.has(ip)){ hits.set(ip,{c:1,t:now}); return next(); }
  let r=hits.get(ip);
  if(now-r.t>9e5){ r.c=1; r.t=now; return next(); }
  if(++r.c>500) return res.status(429).json({message:'Too many requests'});
  next();
}
app.use(rateLimiter);

// routes / health
app.get('/', (req,res)=>res.json({status:'BD Paint Pro Running', secured:'100%'}));
app.get('/health', (req,res)=>res.json({status:'ok', uptime:process.uptime(), timestamp:new Date()}));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/paint', require('./routes/paint'));

module.exports = app;