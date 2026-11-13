import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Register() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('customer');
  const [msg, setMsg] = useState('');
  const nav = useNavigate();

  async function handle(e) {
    e.preventDefault();
    const res = await fetch('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password, role })
    });
    const data = await res.json();
    if (data.token || data.success) nav('/login');
    else setMsg(data.message || 'Register Failed');
  }

  return (
    <form onSubmit={handle} style={{padding:20}}>
      <h2>Register</h2>
      <input placeholder="Name" value={name} onChange={e=>setName(e.target.value)} /><br/><br/>
      <input placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} /><br/><br/>
      <input type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} /><br/><br/>
      <select value={role} onChange={e=>setRole(e.target.value)}>
        <option value="customer">Customer</option>
        <option value="mistri">Mistri</option>
        <option value="agent">Agent</option>
        <option value="merchant">Merchant</option>
      </select><br/><br/>
      <button type="submit">Register</button>
      <p>{msg}</p>
    </form>
  );
}