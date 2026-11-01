import jwt from 'jsonwebtoken';
export const auth = (req,res,next)=>{
  const token = req.headers.authorization;
  if(!token) return res.status(401).json({error:'No token'});
  try { req.user = jwt.verify(token.split(' ')[1], process.env.JWT_SECRET); next(); }
  catch { return res.status(403).json({error:'Invalid token'}); }
};