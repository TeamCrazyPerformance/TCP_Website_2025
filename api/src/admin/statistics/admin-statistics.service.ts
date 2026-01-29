import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface StatisticsData {
    foundingYear: number;
    totalMembers: number;
    studyGroups: number;
    awards: number;
    projects: number;
    employmentRate: number;
}

@Injectable()
export class AdminStatisticsService {
    private readonly jsonPath = path.join(process.cwd(), 'json');
    private readonly statsFilePath = path.join(this.jsonPath, 'statistic.json');

    getStatistics(): StatisticsData {
        this.ensureJsonDir();
        if (fs.existsSync(this.statsFilePath)) {
            try {
                const content = fs.readFileSync(this.statsFilePath, 'utf-8');
                return JSON.parse(content);
            } catch {
                return this.getDefaultStatistics();
            }
        }
        return this.getDefaultStatistics();
    }

    saveStatistics(stats: Partial<StatisticsData>): void {
        this.ensureJsonDir();
        const existing = this.getStatistics();
        const merged = { ...existing, ...stats };
        fs.writeFileSync(this.statsFilePath, JSON.stringify(merged, null, 2), 'utf-8');
    }

    private getDefaultStatistics(): StatisticsData {
        return {
            foundingYear: 2021,
            totalMembers: 120,
            studyGroups: 15,
            awards: 5,
            projects: 8,
            employmentRate: 85,
        };
    }

    private ensureJsonDir() {
        if (!fs.existsSync(this.jsonPath)) {
            fs.mkdirSync(this.jsonPath, { recursive: true });
        }
    }

    validateStats(data: any): boolean {
        if (!data || typeof data !== 'object') return false;
        // Allow partial updates - just ensure that provided fields are numbers
        const allowedFields = ['foundingYear', 'totalMembers', 'studyGroups', 'awards', 'projects', 'employmentRate'];
        for (const key of Object.keys(data)) {
            if (!allowedFields.includes(key)) return false; // Unknown field
            if (typeof data[key] !== 'number') return false; // Must be a number
        }
        return Object.keys(data).length > 0; // At least one field required
    }
}
