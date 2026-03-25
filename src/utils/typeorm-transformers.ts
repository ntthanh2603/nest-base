import type { ValueTransformer } from 'typeorm';
import type { GeoPoint } from '../commons/interfaces/app.interface';

export const PointTransformer: ValueTransformer = {
  /**
   * Deserialize the value from the database.
   * PostgreSQL returns 'point' as a string like "(lng,lat)".
   */
  from: (value: string | null): GeoPoint | null => {
    if (!value) {
      return null;
    }
    const match = value.match(/\(([^,]+),([^)]+)\)/);
    if (!match) {
      return null;
    }
    return {
      longitude: parseFloat(match[1]),
      latitude: parseFloat(match[2]),
    };
  },

  /**
   * Serialize the value to the database.
   * PostgreSQL expects 'point' as a string like "(lng,lat)".
   */
  to: (value: GeoPoint | null): string | null => {
    if (!value) {
      return null;
    }
    return `(${value.longitude},${value.latitude})`;
  },
};
