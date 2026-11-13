export default function Dashboard() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return (
    <div style={{padding:20}}>
      <h2>Dashboard</h2>
      <p>Nam: {user.name || 'User'}</p>
      <p>Phone: {user.phone || ''}</p>
      <p>Role: {user.role || ''}</p>
      <a href="/jobs">Jobs Dekho</a><br/><br/>
      <button onClick={()=>{localStorage.clear(); window.location.href='/login';}}>Logout</button>
    </div>
  );
}