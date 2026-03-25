import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Address } from '@/commons/interfaces/app.interface';

export class AddressDto implements Address {
  @ApiProperty({ description: 'Province/City' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  province: string;

  @ApiProperty({ description: 'District', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  district?: string;

  @ApiProperty({ description: 'Ward' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  ward: string;

  @ApiProperty({ description: 'Detail address' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  detail: string;
}
