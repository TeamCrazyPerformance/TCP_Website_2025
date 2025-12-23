import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, Not, IsNull } from 'typeorm';
import * as fs from 'fs';
import { Resource } from './entities/resource.entity';

@Injectable()
export class ResourceCleanupService {
    private readonly logger = new Logger(ResourceCleanupService.name);

    constructor(
        @InjectRepository(Resource)
        private readonly resourceRepository: Repository<Resource>,
    ) { }

    /**
     * @description Runs daily at 3:00 AM to clean up soft-deleted resources
     * that are older than 7 days.
     */
    @Cron(CronExpression.EVERY_DAY_AT_3AM)
    async cleanupDeletedResources(): Promise<void> {
        this.logger.log('Starting cleanup of soft-deleted resources...');

        // Calculate the date 7 days ago
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Find all resources that were soft-deleted more than 7 days ago
        const expiredResources = await this.resourceRepository.find({
            where: {
                deleted_at: LessThan(sevenDaysAgo),
            },
        });

        if (expiredResources.length === 0) {
            this.logger.log('No expired resources to clean up.');
            return;
        }

        this.logger.log(`Found ${expiredResources.length} expired resources to clean up.`);

        let deletedCount = 0;
        let errorCount = 0;

        for (const resource of expiredResources) {
            try {
                // Delete the actual file if it exists
                if (fs.existsSync(resource.dir_path)) {
                    fs.unlinkSync(resource.dir_path);
                    this.logger.log(`Deleted file: ${resource.dir_path}`);
                }

                // Delete the database record
                await this.resourceRepository.delete(resource.id);
                deletedCount++;
            } catch (error) {
                this.logger.error(
                    `Failed to delete resource ${resource.id}: ${error.message}`,
                );
                errorCount++;
            }
        }

        this.logger.log(
            `Cleanup completed: ${deletedCount} resources deleted, ${errorCount} errors.`,
        );
    }
}
