export interface Address {
  province: string;
  ward: string;
  detail: string;
  district?: string;
}

export interface GeoPoint {
  longitude: number;
  latitude: number;
}
