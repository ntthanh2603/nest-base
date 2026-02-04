import { PartialType } from '@nestjs/swagger';
import { CreateAbcDto } from './create-abc.dto';

export class UpdateAbcDto extends PartialType(CreateAbcDto) {}
