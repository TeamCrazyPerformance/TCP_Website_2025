import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

export interface TagsData {
  competition: string[];
  study: string[];
  mt: string[];
}

@Injectable()
export class ActivityImagesService {
  private readonly basePath = path.join(
    process.cwd(),
    'uploads',
    'activities',
  );
  private readonly jsonPath = path.join(process.cwd(), 'json');
  private readonly tagsFilePath = path.join(this.jsonPath, 'photos.json');

  async save(
    files: {
      competition?: Express.Multer.File[];
      study?: Express.Multer.File[];
      mt?: Express.Multer.File[];
    } = {},
    removeFlags: {
      competition?: boolean;
      study?: boolean;
      mt?: boolean;
    } = {},
  ) {
    this.ensureDir();

    this.saveOrDelete(
      files.competition?.[0],
      'competition.jpg',
      removeFlags.competition,
    );

    this.saveOrDelete(
      files.study?.[0],
      'study.jpg',
      removeFlags.study,
    );

    this.saveOrDelete(
      files.mt?.[0],
      'mt.jpg',
      removeFlags.mt,
    );
  }

  getAll(): {
    competition: string | null;
    study: string | null;
    mt: string | null;
    tags: TagsData;
  } {
    return {
      competition: this.getImageUrl('competition.jpg'),
      study: this.getImageUrl('study.jpg'),
      mt: this.getImageUrl('mt.jpg'),
      tags: this.getTags(),
    };
  }

  private getImageUrl(filename: string): string | null {
    const filePath = path.join(this.basePath, filename);
    if (fs.existsSync(filePath)) {
      return `/activities/${filename}`;
    }
    return null;
  }

  delete(type: 'competition' | 'study' | 'mt') {
    const filename = `${type}.jpg`;
    const filePath = path.join(this.basePath, filename);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // Tag management methods
  getTags(): TagsData {
    this.ensureJsonDir();
    if (fs.existsSync(this.tagsFilePath)) {
      try {
        const content = fs.readFileSync(this.tagsFilePath, 'utf-8');
        return JSON.parse(content);
      } catch {
        return this.getDefaultTags();
      }
    }
    return this.getDefaultTags();
  }

  saveTags(tags: TagsData): void {
    this.ensureJsonDir();
    fs.writeFileSync(this.tagsFilePath, JSON.stringify(tags, null, 2), 'utf-8');
  }

  private getDefaultTags(): TagsData {
    return {
      competition: [], // Empty default
      study: [],      // Empty default
      mt: [],         // Empty default
    };
  }

  private ensureDir() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
    }
  }

  private ensureJsonDir() {
    if (!fs.existsSync(this.jsonPath)) {
      fs.mkdirSync(this.jsonPath, { recursive: true });
    }
  }

  private saveOrDelete(
    file: Express.Multer.File | undefined,
    filename: string,
    remove?: boolean,
  ) {
    const filePath = path.join(this.basePath, filename);

    // 삭제 요청
    if (remove) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return;
    }

    // 새 파일 저장
    if (file) {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('이미지 파일만 업로드 가능합니다.');
      }

      fs.writeFileSync(filePath, file.buffer);
    }
  }

  resetAll() {
    this.delete('competition');
    this.delete('study');
    this.delete('mt');
    this.saveTags({ competition: [], study: [], mt: [] });
  }

  validateTags(data: any): boolean {
    if (!data || typeof data !== 'object') return false;
    // Check structure
    const keys = ['competition', 'study', 'mt'];
    for (const key of keys) {
      if (!Array.isArray(data[key])) return false;
      // Check if all elements are strings
      if (!data[key].every((item: any) => typeof item === 'string')) return false;
    }
    return true;
  }
}
