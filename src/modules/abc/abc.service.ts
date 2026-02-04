import { Injectable } from '@nestjs/common';
import { CreateAbcDto } from './dto/create-abc.dto';
import { UpdateAbcDto } from './dto/update-abc.dto';

@Injectable()
export class AbcService {
  create(createAbcDto: CreateAbcDto) {
    return 'This action adds a new abc';
  }

  findAll() {
    return `This action returns all abc`;
  }

  findOne(id: number) {
    return `This action returns a #${id} abc`;
  }

  update(id: number, updateAbcDto: UpdateAbcDto) {
    return `This action updates a #${id} abc`;
  }

  remove(id: number) {
    return `This action removes a #${id} abc`;
  }
}
