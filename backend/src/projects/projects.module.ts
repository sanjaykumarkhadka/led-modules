import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Project, ProjectSchema } from './schemas/project.schema';
import {
  ProjectDesignSettings,
  ProjectDesignSettingsSchema,
} from './schemas/project-design-settings.schema';
import { ProjectBlock, ProjectBlockSchema } from './schemas/project-block.schema';
import {
  ProjectCharacter,
  ProjectCharacterSchema,
} from './schemas/project-character.schema';
import {
  CharacterShapeOverride,
  CharacterShapeOverrideSchema,
} from './schemas/character-shape-override.schema';
import { CharacterModule, CharacterModuleSchema } from './schemas/character-module.schema';
import {
  CharacterOverride,
  CharacterOverrideSchema,
} from './schemas/character-override.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Project.name,
        schema: ProjectSchema,
      },
      {
        name: ProjectDesignSettings.name,
        schema: ProjectDesignSettingsSchema,
      },
      {
        name: ProjectBlock.name,
        schema: ProjectBlockSchema,
      },
      {
        name: ProjectCharacter.name,
        schema: ProjectCharacterSchema,
      },
      {
        name: CharacterShapeOverride.name,
        schema: CharacterShapeOverrideSchema,
      },
      {
        name: CharacterModule.name,
        schema: CharacterModuleSchema,
      },
      {
        name: CharacterOverride.name,
        schema: CharacterOverrideSchema,
      },
    ]),
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
