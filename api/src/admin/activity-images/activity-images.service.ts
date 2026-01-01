import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class ActivityImagesService {
  private readonly basePath = path.join(
    process.cwd(),
    'uploads',
    'activities',
  );

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
  } {
    return {
      competition: this.getImageUrl('competition.jpg'),
      study: this.getImageUrl('study.jpg'),
      mt: this.getImageUrl('mt.jpg'),
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

  private ensureDir() {
    if (!fs.existsSync(this.basePath)) {
      fs.mkdirSync(this.basePath, { recursive: true });
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
}
