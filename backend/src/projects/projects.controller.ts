import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ProjectsService } from './projects.service';

@UseGuards(AuthGuard('jwt'))
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async list(@Req() req: any) {
    return this.projectsService.listForUser(req.user.userId);
  }

  @Post()
  async create(
    @Req() req: any,
    @Body() body: { name: string; description?: string; isFavorite?: boolean },
  ) {
    return this.projectsService.createForUser(req.user.userId, body);
  }

  @Get(':id')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getForUser(req.user.userId, id);
  }

  @Patch(':id')
  async updateMeta(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; isFavorite?: boolean },
  ) {
    return this.projectsService.updateForUser(req.user.userId, id, body);
  }

  @Delete(':id')
  async delete(@Req() req: any, @Param('id') id: string) {
    await this.projectsService.deleteForUser(req.user.userId, id);
    return { success: true };
  }

  @Get(':id/design-settings')
  async getDesignSettings(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.getDesignSettings(req.user.userId, id);
  }

  @Patch(':id/design-settings')
  async patchDesignSettings(
    @Req() req: any,
    @Param('id') id: string,
    @Body()
    body: {
      depthInches?: number;
      selectedModuleId?: string;
      showDimensions?: boolean;
      dimensionUnit?: 'mm' | 'in';
      defaultLedCount?: number;
      defaultLedColumns?: number;
      defaultLedOrientation?: 'horizontal' | 'vertical' | 'auto';
    },
  ) {
    return this.projectsService.patchDesignSettings(req.user.userId, id, body);
  }

  @Get(':id/blocks')
  async listBlocks(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.listBlocks(req.user.userId, id);
  }

  @Put(':id/blocks/:blockId')
  async upsertBlock(
    @Req() req: any,
    @Param('id') id: string,
    @Param('blockId') blockId: string,
    @Body()
    body: {
      text: string;
      x: number;
      y: number;
      fontSize: number;
      language: string;
      order: number;
    },
  ) {
    return this.projectsService.upsertBlock(req.user.userId, id, {
      id: blockId,
      ...body,
    });
  }

  @Delete(':id/blocks/:blockId')
  async deleteBlock(@Req() req: any, @Param('id') id: string, @Param('blockId') blockId: string) {
    await this.projectsService.deleteBlock(req.user.userId, id, blockId);
    return { success: true };
  }

  @Get(':id/characters')
  async listCharacters(
    @Req() req: any,
    @Param('id') id: string,
    @Query('blockId') blockId?: string,
  ) {
    return this.projectsService.listCharacters(req.user.userId, id, blockId);
  }

  @Put(':id/characters/:characterId')
  async upsertCharacter(
    @Req() req: any,
    @Param('id') id: string,
    @Param('characterId') characterId: string,
    @Body()
    body: {
      blockId: string;
      glyph: string;
      x: number;
      baselineY: number;
      fontSize: number;
      language: string;
      order: number;
    },
  ) {
    return this.projectsService.upsertCharacter(req.user.userId, id, {
      id: characterId,
      ...body,
    });
  }

  @Delete(':id/characters/:characterId')
  async deleteCharacter(
    @Req() req: any,
    @Param('id') id: string,
    @Param('characterId') characterId: string,
  ) {
    await this.projectsService.deleteCharacter(req.user.userId, id, characterId);
    return { success: true };
  }

  @Get(':id/shapes')
  async listShapes(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.listAllShapeOverrides(req.user.userId, id);
  }

  @Get(':id/characters/:characterId/shape')
  async getShape(@Req() req: any, @Param('id') id: string, @Param('characterId') characterId: string) {
    return this.projectsService.getShapeOverride(req.user.userId, id, characterId);
  }

  @Put(':id/characters/:characterId/shape')
  async putShape(
    @Req() req: any,
    @Param('id') id: string,
    @Param('characterId') characterId: string,
    @Body()
    body: {
      version: number;
      baseBBox: { x: number; y: number; width: number; height: number };
      mesh: { rows: number; cols: number; points: Array<{ x: number; y: number }> };
    },
  ) {
    return this.projectsService.putShapeOverride(req.user.userId, id, characterId, body);
  }

  @Delete(':id/characters/:characterId/shape')
  async deleteShape(
    @Req() req: any,
    @Param('id') id: string,
    @Param('characterId') characterId: string,
  ) {
    await this.projectsService.deleteShapeOverride(req.user.userId, id, characterId);
    return { success: true };
  }

  @Get(':id/modules')
  async listModulesAll(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.listAllModules(req.user.userId, id);
  }

  @Get(':id/characters/:characterId/modules')
  async listModules(
    @Req() req: any,
    @Param('id') id: string,
    @Param('characterId') characterId: string,
  ) {
    return this.projectsService.listModules(req.user.userId, id, characterId);
  }

  @Put(':id/characters/:characterId/modules')
  async replaceModules(
    @Req() req: any,
    @Param('id') id: string,
    @Param('characterId') characterId: string,
    @Body()
    body: { modules: Array<{ id: string; u: number; v: number; rotation: number; scale?: number }> },
  ) {
    return this.projectsService.replaceModules(req.user.userId, id, characterId, body.modules ?? []);
  }

  @Get(':id/overrides')
  async listOverridesAll(@Req() req: any, @Param('id') id: string) {
    return this.projectsService.listAllCharacterOverrides(req.user.userId, id);
  }

  @Get(':id/characters/:characterId/overrides')
  async getOverride(
    @Req() req: any,
    @Param('id') id: string,
    @Param('characterId') characterId: string,
  ) {
    return this.projectsService.getCharacterOverride(req.user.userId, id, characterId);
  }

  @Patch(':id/characters/:characterId/overrides')
  async patchOverride(
    @Req() req: any,
    @Param('id') id: string,
    @Param('characterId') characterId: string,
    @Body()
    body: {
      ledCount?: number;
      ledColumns?: number;
      ledOrientation?: 'horizontal' | 'vertical' | 'auto';
      placementMode?: 'manual' | 'auto';
    },
  ) {
    return this.projectsService.patchCharacterOverride(req.user.userId, id, characterId, body);
  }

  @Delete(':id/characters/:characterId/overrides')
  async deleteOverride(
    @Req() req: any,
    @Param('id') id: string,
    @Param('characterId') characterId: string,
  ) {
    await this.projectsService.deleteCharacterOverride(req.user.userId, id, characterId);
    return { success: true };
  }
}
