import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const nav = useNavigate();

  async function handle(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        nav('/dashboard');
      } else {
        setMsg(data.message || 'Login Failed');
      }
    } catch {
      setMsg('Server Connect Hoy Nai');
    }
  }

  return (
    <form onSubmit={handle} style={{padding:20}}>
      <h2>Login</h2>
      <input placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} /><br/><br/>
      <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} /><br/><br/>
      <button type="submit">Login</button>
      <p>{msg}</p>
    </form>
  );
}