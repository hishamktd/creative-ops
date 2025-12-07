export interface JobOptions {
  priority?: 'low' | 'normal' | 'high'
  retryAttempts?: number
  retryDelay?: number
  timeout?: number
  onProgress?: (progress: number) => void
  onComplete?: (result: any) => void
  onError?: (error: Error) => void
}

export interface Job<T = any> {
  id: string
  type: string
  data: T
  options: JobOptions
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  result?: any
  error?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
  attempts: number
}

export interface JobProcessor<T = any> {
  process: (data: T, job: Job<T>) => Promise<any>
}

export class BackgroundJobService {
  private static instance: BackgroundJobService
  private jobs = new Map<string, Job>()
  private processors = new Map<string, JobProcessor>()
  private queues = {
    high: [] as Job[],
    normal: [] as Job[],
    low: [] as Job[]
  }
  private isProcessing = false
  private maxConcurrentJobs = 3
  private runningJobs = new Set<string>()

  private constructor() {
    this.startProcessing()
  }

  static getInstance(): BackgroundJobService {
    if (!this.instance) {
      this.instance = new BackgroundJobService()
    }
    return this.instance
  }

  /**
   * Register a job processor
   */
  registerProcessor<T>(type: string, processor: JobProcessor<T>): void {
    this.processors.set(type, processor)
  }

  /**
   * Add a job to the queue
   */
  addJob<T>(
    type: string,
    data: T,
    options: JobOptions = {}
  ): string {
    const jobId = this.generateJobId()
    const job: Job<T> = {
      id: jobId,
      type,
      data,
      options: {
        priority: 'normal',
        retryAttempts: 3,
        retryDelay: 1000,
        timeout: 30000,
        ...options
      },
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      attempts: 0
    }

    this.jobs.set(jobId, job)
    this.queues[job.options.priority!].push(job)
    
    // Sort by creation time (FIFO within priority)
    this.queues[job.options.priority!].sort((a, b) => a.createdAt - b.createdAt)

    return jobId
  }

  /**
   * Get job status
   */
  getJob(jobId: string): Job | undefined {
    return this.jobs.get(jobId)
  }

  /**
   * Cancel a job
   */
  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    if (job.status === 'pending') {
      job.status = 'cancelled'
      this.removeFromQueue(job)
      return true
    }

    if (job.status === 'running') {
      job.status = 'cancelled'
      this.runningJobs.delete(jobId)
      return true
    }

    return false
  }

  /**
   * Get all jobs with optional filtering
   */
  getJobs(filter?: {
    status?: Job['status']
    type?: string
  }): Job[] {
    const allJobs = Array.from(this.jobs.values())
    
    if (!filter) return allJobs

    return allJobs.filter(job => {
      if (filter.status && job.status !== filter.status) return false
      if (filter.type && job.type !== filter.type) return false
      return true
    })
  }

  /**
   * Clear completed jobs older than specified time
   */
  clearOldJobs(olderThanMs: number = 24 * 60 * 60 * 1000): void {
    const cutoff = Date.now() - olderThanMs
    
    for (const [jobId, job] of this.jobs.entries()) {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.createdAt < cutoff
      ) {
        this.jobs.delete(jobId)
      }
    }
  }

  /**
   * Start processing jobs
   */
  private startProcessing(): void {
    if (this.isProcessing) return
    
    this.isProcessing = true
    this.processNextJob()
  }

  /**
   * Process the next job in queue
   */
  private async processNextJob(): Promise<void> {
    if (this.runningJobs.size >= this.maxConcurrentJobs) {
      // Wait a bit and try again
      setTimeout(() => this.processNextJob(), 100)
      return
    }

    const job = this.getNextJob()
    if (!job) {
      // No jobs available, wait and try again
      setTimeout(() => this.processNextJob(), 1000)
      return
    }

    await this.processJob(job)
    
    // Continue processing
    setImmediate(() => this.processNextJob())
  }

  /**
   * Get the next job to process (priority-based)
   */
  private getNextJob(): Job | null {
    // Check high priority first
    if (this.queues.high.length > 0) {
      return this.queues.high.shift()!
    }
    
    // Then normal priority
    if (this.queues.normal.length > 0) {
      return this.queues.normal.shift()!
    }
    
    // Finally low priority
    if (this.queues.low.length > 0) {
      return this.queues.low.shift()!
    }

    return null
  }

  /**
   * Process a single job
   */
  private async processJob(job: Job): Promise<void> {
    const processor = this.processors.get(job.type)
    if (!processor) {
      job.status = 'failed'
      job.error = `No processor registered for job type: ${job.type}`
      job.completedAt = Date.now()
      return
    }

    job.status = 'running'
    job.startedAt = Date.now()
    job.attempts++
    this.runningJobs.add(job.id)

    try {
      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), job.options.timeout)
      })

      // Process job with timeout
      const result = await Promise.race([
        processor.process(job.data, job),
        timeoutPromise
      ])

      job.status = 'completed'
      job.result = result
      job.progress = 100
      job.completedAt = Date.now()
      job.options.onComplete?.(result)

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      if (job.attempts < (job.options.retryAttempts || 3)) {
        // Retry the job
        job.status = 'pending'
        job.progress = 0
        
        // Add back to queue with delay
        setTimeout(() => {
          this.queues[job.options.priority!].push(job)
        }, job.options.retryDelay || 1000)
      } else {
        // Max retries reached
        job.status = 'failed'
        job.error = errorMessage
        job.completedAt = Date.now()
        job.options.onError?.(error instanceof Error ? error : new Error(errorMessage))
      }
    } finally {
      this.runningJobs.delete(job.id)
    }
  }

  /**
   * Remove job from queue
   */
  private removeFromQueue(job: Job): void {
    const queue = this.queues[job.options.priority!]
    const index = queue.findIndex(j => j.id === job.id)
    if (index !== -1) {
      queue.splice(index, 1)
    }
  }

  /**
   * Generate unique job ID
   */
  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`
  }

  /**
   * Update job progress
   */
  updateJobProgress(jobId: string, progress: number): void {
    const job = this.jobs.get(jobId)
    if (job && job.status === 'running') {
      job.progress = Math.max(0, Math.min(100, progress))
      job.options.onProgress?.(job.progress)
    }
  }

  /**
   * Get queue statistics
   */
  getStats(): {
    pending: number
    running: number
    completed: number
    failed: number
    queues: {
      high: number
      normal: number
      low: number
    }
  } {
    const jobs = Array.from(this.jobs.values())
    
    return {
      pending: jobs.filter(j => j.status === 'pending').length,
      running: jobs.filter(j => j.status === 'running').length,
      completed: jobs.filter(j => j.status === 'completed').length,
      failed: jobs.filter(j => j.status === 'failed').length,
      queues: {
        high: this.queues.high.length,
        normal: this.queues.normal.length,
        low: this.queues.low.length
      }
    }
  }
}

// Asset-specific job processors
export class AssetJobProcessors {
  /**
   * Register all asset-related job processors
   */
  static registerAll(): void {
    const jobService = BackgroundJobService.getInstance()

    // Thumbnail generation processor
    jobService.registerProcessor('generate-thumbnail', {
      process: async (data: { file: File; originalPath: string }, job) => {
        const { ThumbnailService } = await import('./thumbnail')
        
        jobService.updateJobProgress(job.id, 10)
        
        const result = await ThumbnailService.generateThumbnail(
          data.file,
          data.originalPath,
          {
            width: 300,
            height: 300,
            quality: 80
          }
        )
        
        jobService.updateJobProgress(job.id, 100)
        return result
      }
    })

    // Metadata extraction processor
    jobService.registerProcessor('extract-metadata', {
      process: async (data: { file: File; assetId: string }, job) => {
        const { MetadataExtractionService } = await import('./metadataExtraction')
        
        jobService.updateJobProgress(job.id, 20)
        
        const metadata = await MetadataExtractionService.extractMetadata(data.file)
        
        jobService.updateJobProgress(job.id, 80)
        
        // Store metadata in database
        // This would typically involve a database call
        
        jobService.updateJobProgress(job.id, 100)
        return metadata
      }
    })

    // Image optimization processor
    jobService.registerProcessor('optimize-image', {
      process: async (data: { imageUrl: string; options: any }, job) => {
        jobService.updateJobProgress(job.id, 10)
        
        // Image optimization logic would go here
        // This might involve calling external services or using canvas/WebAssembly
        
        jobService.updateJobProgress(job.id, 50)
        
        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        jobService.updateJobProgress(job.id, 100)
        
        return {
          originalUrl: data.imageUrl,
          optimizedUrl: data.imageUrl, // Would be the optimized version
          compressionRatio: 0.7,
          sizeSaved: 1024 * 30 // 30KB saved
        }
      }
    })

    // Batch processing processor
    jobService.registerProcessor('batch-process', {
      process: async (data: { operations: any[] }, job) => {
        const results = []
        const total = data.operations.length
        
        for (let i = 0; i < data.operations.length; i++) {
          const operation = data.operations[i]
          
          // Process individual operation
          const result = await this.processOperation(operation)
          results.push(result)
          
          // Update progress
          const progress = Math.round(((i + 1) / total) * 100)
          jobService.updateJobProgress(job.id, progress)
        }
        
        return results
      }
    })
  }

  private static async processOperation(operation: any): Promise<any> {
    // Simulate operation processing
    await new Promise(resolve => setTimeout(resolve, 100))
    return { ...operation, processed: true }
  }
}

// Initialize asset job processors
if (typeof window !== 'undefined') {
  AssetJobProcessors.registerAll()
}