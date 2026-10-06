import type { Repository, DeploymentRecord, ConnectionCheck, WorkflowRun } from "#shared/contracts";
import { AppError } from "#worker/errors";
export async function listDeployments(repo:Repository,limit:number):Promise<DeploymentRecord[]> {
 const commits=await repo.listCommits(Math.min(limit,20)),records:DeploymentRecord[]=[];
 for(const commit of commits) {
  let runs:WorkflowRun[];
  try{runs=await repo.listWorkflowRuns(commit.sha);}catch(error){if(error instanceof AppError && error.status===404)runs=[];else throw error;}
  const run=runs.filter(row=>row.headSha===commit.sha && row.workflowPath.split("@")[0]===".github/workflows/deploy-pages.yml").sort((a,b)=>b.id-a.id)[0] || null;
  records.push({commit,run});
 }
 return records;
}
export async function checkConnection(repo:Repository):Promise<ConnectionCheck> {return repo.checkConnection();}

