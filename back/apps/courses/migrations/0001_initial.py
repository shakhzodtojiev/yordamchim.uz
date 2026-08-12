# Hand-authored initial migration for apps.courses (Docker was unavailable
# when the app was scaffolded, so `makemigrations` couldn't be run — this
# mirrors what it would have generated for the Phase 1 model shape).

import apps.courses.models
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('attestation', '0001_initial'),
        ('personalization', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Course',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('quarter', models.PositiveSmallIntegerField(blank=True, choices=[(1, '1'), (2, '2'), (3, '3'), (4, '4')], null=True)),
                ('cover_image', models.ImageField(blank=True, null=True, upload_to=apps.courses.models.course_cover_upload_path)),
                ('is_published', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('grade', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='courses', to='personalization.grade')),
                ('subject', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='courses', to='personalization.subject')),
            ],
            options={
                'ordering': ('-created_at',),
            },
        ),
        migrations.CreateModel(
            name='Lesson',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('description', models.TextField(blank=True)),
                ('kind', models.CharField(choices=[('video', 'Video'), ('text', 'Matnli'), ('test', 'Test')], max_length=10)),
                ('video_url', models.URLField(blank=True)),
                ('video_file', models.FileField(blank=True, null=True, upload_to=apps.courses.models.lesson_video_upload_path)),
                ('body', models.TextField(blank=True)),
                ('duration_seconds', models.PositiveIntegerField(blank=True, null=True)),
                ('is_published', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('grade', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='lessons', to='personalization.grade')),
                ('subject', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='lessons', to='personalization.subject')),
                ('test', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name='lessons', to='attestation.test')),
                ('topic_pool', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='lessons', to='attestation.topicpool')),
            ],
            options={
                'ordering': ('-created_at',),
            },
        ),
        migrations.CreateModel(
            name='Module',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=200)),
                ('order', models.PositiveIntegerField()),
                ('course', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='modules', to='courses.course')),
            ],
            options={
                'ordering': ('order',),
            },
        ),
        migrations.CreateModel(
            name='ModuleLesson',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('order', models.PositiveIntegerField()),
                ('lesson', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='module_links', to='courses.lesson')),
                ('module', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='module_lessons', to='courses.module')),
            ],
            options={
                'ordering': ('order',),
            },
        ),
        migrations.CreateModel(
            name='LessonCompletion',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('completed_at', models.DateTimeField(auto_now_add=True)),
                ('lesson', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='completions', to='courses.lesson')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='lesson_completions', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.AddIndex(
            model_name='course',
            index=models.Index(fields=['subject', 'grade'], name='courses_cou_subject_5d0e17_idx'),
        ),
        migrations.AddIndex(
            model_name='course',
            index=models.Index(fields=['is_published', '-created_at'], name='courses_cou_is_publ_2c1a7e_idx'),
        ),
        migrations.AddIndex(
            model_name='lesson',
            index=models.Index(fields=['subject', 'grade'], name='courses_les_subject_a2b3d8_idx'),
        ),
        migrations.AddIndex(
            model_name='lesson',
            index=models.Index(fields=['kind', 'is_published'], name='courses_les_kind_e91b45_idx'),
        ),
        migrations.AddIndex(
            model_name='lesson',
            index=models.Index(fields=['topic_pool', 'kind'], name='courses_les_topic_p_74af62_idx'),
        ),
        migrations.AddIndex(
            model_name='lessoncompletion',
            index=models.Index(fields=['user', '-completed_at'], name='courses_les_user_id_c8d491_idx'),
        ),
        migrations.AddConstraint(
            model_name='module',
            constraint=models.UniqueConstraint(fields=('course', 'order'), name='module_order_unique'),
        ),
        migrations.AddConstraint(
            model_name='modulelesson',
            constraint=models.UniqueConstraint(fields=('module', 'order'), name='module_lesson_order_unique'),
        ),
        migrations.AddConstraint(
            model_name='modulelesson',
            constraint=models.UniqueConstraint(fields=('module', 'lesson'), name='module_lesson_unique'),
        ),
        migrations.AddConstraint(
            model_name='lessoncompletion',
            constraint=models.UniqueConstraint(fields=('user', 'lesson'), name='lesson_completion_unique'),
        ),
    ]
