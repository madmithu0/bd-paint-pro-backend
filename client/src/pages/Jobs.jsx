import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

export default function Jobs() {
  const [jobs, setJobs] = useState([]);
  useEffect(()=>{
    fetch('/api/v1/jobs').then(r=>r.json()).then(d=>setJobs(d.jobs || d.data || [])).catch(()=>{});
  },[]);
  return (
    <div style={{padding:20}}>
      <h2>Jobs</h2>
      {jobs.length===0 && <p>Kono Job Nai / Server Theke Ase Nai</p>}
      {jobs.map(j=>(
        <div key={j._id} style={{border:'1px solid #ccc', padding:10, marginBottom:10}}>
          <Link to={`/jobs/${j._id}`}>{j.title || 'Job'} - {j.sqft || ''} Sqft</Link>
        </div>
      ))}
    </div>
  );
}