import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

import { PASSWORD_MIN_LENGTH } from '@isd/shared-types';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @MinLength(1, { message: 'Current password is required.' })
  currentPassword: string;

  /**
   * Length and character-class rules are enforced in the service via
   * `checkPasswordPolicy`, so the policy has exactly one definition. The
   * decorator here only catches the obviously-too-short case early.
   */
  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(200)
  newPassword: string;
}
