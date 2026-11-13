import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

export default function JobDetails() {
  const { id } = useParams();
  const [job, setJob] = useState(null);
  useEffect(()=>{
    fetch(`/api/v1/jobs/${id}`).then(r=>r.json()).then(d=>setJob(d.job || d.data || d)).catch(()=>{});
  },[id]);
  if(!job) return <div style={{padding:20}}>Loading...</div>;
  return (
    <div style={{padding:20}}>
      <h2>Job Details</h2>
      <p>ID: {id}</p>
      <p>Sqft: {job.sqft}</p>
      <p>Price: {job.price} Taka</p>
      <p>Status: {job.status}</p>
      <p>Mistri Share: {job.mistriShare} | Agent Share: {job.agentShare} | Platform Share: {job.platformShare}</p>
    </div>
  );
}