import express from 'express';
import jwt from 'jsonwebtoken';
const router = express.Router();
router.post('/login', async (req,res)=>{
  const token = jwt.sign({role:'agent'}, process.env.JWT_SECRET);
  res.json({token, face:'required', voice:'required', phone:'BTRC verified'});
});
export default router;