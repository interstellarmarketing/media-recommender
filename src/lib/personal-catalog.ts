import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

interface PersonalMediaItem {
  title: string;
  type: 'movie' | 'tv';
  id: number;
}

export async function getPersonalCatalog(): Promise<PersonalMediaItem[]> {
  const csvPath = path.join(process.cwd(), 'src', 'data', 'personal-catalog.csv');
  const fileContent = fs.readFileSync(csvPath, 'utf-8');
  
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    cast: (value, context) => {
      if (context.column === 'ID') {
        return parseInt(value);
      }
      if (context.column === 'Type') {
        return value.toLowerCase();
      }
      return value;
    }
  });

  return records.map((record: any) => ({
    title: record.Title,
    type: record.Type,
    id: record.ID
  }));
} 