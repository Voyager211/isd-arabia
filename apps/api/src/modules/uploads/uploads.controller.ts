import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CloudinaryService } from './cloudinary.service';
import { UploadSignatureDto } from './dto/upload-signature.dto';

@ApiTags('Admin — uploads')
@Controller('admin/uploads')
export class UploadsController {
  constructor(private readonly cloudinary: CloudinaryService) {}

  @Post('signature')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Signed params for a direct-to-Cloudinary upload' })
  signature(@Body() dto: UploadSignatureDto) {
    return this.cloudinary.buildUploadSignature(dto);
  }
}
