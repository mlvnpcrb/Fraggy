import type { Draft, Job } from "./types";
type Gateway = <T>(
  action: string,
  data?: Record<string, unknown>,
) => Promise<T>;
export async function recoverUploadedCapture(job: Job, gateway: Gateway) {
  if (job.status !== "uploading") return false;
  const upload = await gateway<{ uploaded?: boolean }>("resume-upload", {
    job_id: job.id,
  });
  if (!upload.uploaded) return false;
  await gateway("start-capture", { job_id: job.id, draft: job.draft });
  return true;
}
export async function processCapture(
  draft: Draft,
  deps: {
    gateway: Gateway;
    save: (draft: Draft) => Promise<void>;
    upload: (url: string, uri: string) => Promise<void>;
    loadJobs: () => Promise<Job[]>;
    latestForm: () => Draft["form"];
    refresh: () => Promise<void>;
    isCurrent: () => boolean;
  },
) {
  const check = () => {
    if (!deps.isCurrent())
      throw Error(
        "Account changed. Capture remains with its original collector.",
      );
  };
  check();
  let current = draft;
  try {
    if (!current.jobId) {
      const result = await deps.gateway<{ job: Job; upload_url: string }>(
        "create-capture",
      );
      check();
      current = {
        ...current,
        jobId: result.job.id,
        form: deps.latestForm(),
        error: undefined,
      };
      await deps.save(current);
      check();
      await deps.upload(result.upload_url, current.uri);
      check();
    } else {
      const jobs = await deps.loadJobs();
      check();
      const job = jobs.find((j) => j.id === current.jobId);
      if (job?.status === "uploading") {
        const ticket = await deps.gateway<{
          uploaded?: boolean;
          upload_url: string;
        }>("resume-upload", { job_id: current.jobId });
        check();
        if (!ticket.uploaded) await deps.upload(ticket.upload_url, current.uri);
        check();
      }
    }
    check();
    await deps.gateway("start-capture", {
      job_id: current.jobId,
      draft: deps.latestForm(),
    });
    check();
    await deps.refresh();
    check();
    return current.jobId!;
  } catch (error) {
    if (!deps.isCurrent()) throw error;
    await deps.save({
      ...current,
      form: deps.latestForm(),
      error: error instanceof Error ? error.message : "Upload failed.",
    });
    throw error;
  }
}
