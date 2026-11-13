
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

type ProjectStatus = 'planned' | 'ongoing' | 'completed' | 'suspended';
type FilterStatus = 'all' | ProjectStatus;

type Project = {
  id: string;
  title: string;
  description: string | null;
  state: string;
  lga: string | null;
  community: string | null;
  location_details: string | null;
  start_date: string | null;
  expected_completion_date: string | null;
  progress: number;
  status: ProjectStatus;
  image_urls: string[];
  is_demo: boolean;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

type GalleryImage = {
  image_url: string;
  storage_path: string | null;
  localUri?: string;
  isNew?: boolean;
};

type ProjectForm = {
  title: string;
  description: string;
  community: string;
  start_date: string;
  expected_completion_date: string;
  progress: string;
  status: ProjectStatus;
  is_published: boolean;
};

const BUCKET = 'project-images';
const MAX_IMAGES = 10;

const GREEN = '#176B45';
const DARK_GREEN = '#104D33';
const LIGHT_GREEN = '#EAF5EE';
const BACKGROUND = '#F5F7F6';
const TEXT = '#18251F';
const MUTED = '#6B7770';
const BORDER = '#E0E7E2';
const WHITE = '#FFFFFF';

const STATUS_OPTIONS: {
  label: string;
  value: ProjectStatus;
  color: string;
  background: string;
}[] = [
  { label: 'Planned', value: 'planned', color: '#8A5B12', background: '#FFF2D8' },
  { label: 'Ongoing', value: 'ongoing', color: '#176B45', background: '#E4F5EA' },
  { label: 'Completed', value: 'completed', color: '#1761A0', background: '#E5F1FF' },
  { label: 'Suspended', value: 'suspended', color: '#A33A32', background: '#FCEAE8' },
];

const EMPTY_FORM: ProjectForm = {
  title: '',
  description: '',
  community: '',
  start_date: '',
  expected_completion_date: '',
  progress: '0',
  status: 'planned',
  is_published: false,
};

function isValidDate(value: string): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Not set';

  const datePart = value.slice(0, 10);
  if (!isValidDate(datePart)) return value;

  const [year, month, day] = datePart.split('-').map(Number);

  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
    'en-GB',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }
  );
}

function getStatus(status: string | null) {
  return (
    STATUS_OPTIONS.find((item) => item.value === status) ?? {
      label: status || 'Unspecified',
      value: status || '',
      color: '#59645E',
      background: '#EDF0EE',
    }
  );
}

function getStoragePath(imageUrl: string | null) {
  if (!imageUrl) return null;

  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = imageUrl.indexOf(marker);

  if (index === -1) return null;

  try {
    return decodeURIComponent(
      imageUrl.slice(index + marker.length).split('?')[0]
    );
  } catch {
    return imageUrl.slice(index + marker.length).split('?')[0];
  }
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  helper,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: 'default' | 'numeric' | 'numbers-and-punctuation';
  helper?: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9AA49E"
        style={[styles.input, multiline && styles.multilineInput]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        keyboardType={keyboardType || 'default'}
        autoCapitalize="none"
      />

      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </View>
  );
}

export default function ProjectsScreen() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterStatus>('all');

  const [formVisible, setFormVisible] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>([]);

  const loadProjects = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);

    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProjects((data ?? []) as Project[]);
    } catch (error: any) {
      Alert.alert(
        'Unable to load projects',
        error?.message || 'Please check your connection and try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const updateForm = (
    key: keyof ProjectForm,
    value: string | boolean
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const openAddForm = () => {
    setEditingProject(null);
    setForm({ ...EMPTY_FORM });
    setGalleryImages([]);
    setFormVisible(true);
  };

  const openEditForm = (project: Project) => {
    setEditingProject(project);

    setForm({
      title: project.title || '',
      description: project.description || '',
      community: project.community || '',
      start_date: project.start_date || '',
      expected_completion_date: project.expected_completion_date || '',
      progress: String(project.progress ?? 0),
      status: project.status || 'planned',
      is_published: project.is_published,
    });

    setGalleryImages(
      (project.image_urls || []).map((url) => ({
        image_url: url,
        storage_path: getStoragePath(url),
      }))
    );

    setFormVisible(true);
  };

  const closeForm = () => {
    if (saving) return;

    setFormVisible(false);
    setEditingProject(null);
    setGalleryImages([]);
  };

  const chooseProjectImages = async () => {
    try {
      const remainingSlots = MAX_IMAGES - galleryImages.length;

      if (remainingSlots <= 0) {
        Alert.alert(
          'Image limit reached',
          `A project can have up to ${MAX_IMAGES} photographs.`
        );
        return;
      }

      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Photo permission needed',
          'Allow photo library access to choose project photographs.'
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });

      if (result.canceled || !result.assets?.length) return;

      const newImages: GalleryImage[] = result.assets.map((asset) => ({
        image_url: '',
        storage_path: null,
        localUri: asset.uri,
        isNew: true,
      }));

      setGalleryImages((current) => [
        ...current,
        ...newImages,
      ]);
    } catch (error: any) {
      Alert.alert(
        'Could not select photographs',
        error?.message || 'Please try again.'
      );
    }
  };

  const removeGalleryImage = (index: number) => {
    Alert.alert(
      'Remove photograph?',
      'This photograph will be removed when you save the project.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setGalleryImages((current) =>
              current.filter((_, imageIndex) => imageIndex !== index)
            );
          },
        },
      ]
    );
  };

  const uploadProjectImage = async (
    uri: string,
    projectId: string
  ) => {
    const response = await fetch(uri);

    if (!response.ok) {
      throw new Error('A selected photograph could not be read.');
    }

    const fileBuffer = await response.arrayBuffer();

    const extension = uri.split('.').pop()?.split('?')[0]?.toLowerCase() || 'jpg';

    const safeExtension = ['jpg', 'jpeg', 'png', 'webp'].includes(extension)
      ? extension
      : 'jpg';

    const filePath =
      `projects/${projectId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 9)}.${safeExtension}`;

    const contentType =
      safeExtension === 'png'
        ? 'image/png'
        : safeExtension === 'webp'
          ? 'image/webp'
          : 'image/jpeg';

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (error) throw error;

    const { data } = supabase.storage
      .from(BUCKET)
      .getPublicUrl(filePath);

    return {
      url: data.publicUrl,
      path: filePath,
    };
  };

  const removeStorageFiles = async (paths: string[]) => {
    const uniquePaths = [...new Set(paths.filter(Boolean))];

    if (uniquePaths.length === 0) return;

    const { error } = await supabase.storage
      .from(BUCKET)
      .remove(uniquePaths);

    if (error) throw error;
  };

  const saveProject = async () => {
    const title = form.title.trim();
    const community = form.community.trim();
    const progressText = form.progress.trim();

    if (!title) {
      Alert.alert('Project title required', 'Enter a title for this project.');
      return;
    }

    if (!community) {
      Alert.alert('Community required', 'Enter the project community.');
      return;
    }

    const progress = Number(progressText);

    if (
      progressText === '' ||
      !Number.isInteger(progress) ||
      progress < 0 ||
      progress > 100
    ) {
      Alert.alert(
        'Invalid progress',
        'Progress must be a whole number from 0 to 100.'
      );
      return;
    }

    const startDate = form.start_date.trim();
    const completionDate = form.expected_completion_date.trim();

    if (!isValidDate(startDate) || !isValidDate(completionDate)) {
      Alert.alert(
        'Invalid date',
        'Enter a valid date in YYYY-MM-DD format. Example: 2026-10-30.'
      );
      return;
    }

    if (startDate && completionDate && completionDate < startDate) {
      Alert.alert(
        'Check your dates',
        'The expected completion date cannot be earlier than the start date.'
      );
      return;
    }

    setSaving(true);

    const newlyUploadedPaths: string[] = [];

    try {
      const payload = {
        title,
        description: form.description.trim() || null,
        community,
        start_date: startDate || null,
        expected_completion_date: completionDate || null,
        progress,
        status: form.status,
        is_published: form.is_published,
        updated_at: new Date().toISOString(),
      };

      let projectId = editingProject?.id;

      if (editingProject) {
        const { error } = await supabase
          .from('projects')
          .update(payload)
          .eq('id', editingProject.id);

        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('projects')
          .insert(payload)
          .select('id')
          .single();

        if (error) throw error;

        projectId = data.id;
      }

      if (!projectId) {
        throw new Error('The project ID could not be found.');
      }

      const finalImageUrls: string[] = [];

      for (const image of galleryImages) {
        if (image.isNew && image.localUri) {
          const uploaded = await uploadProjectImage(
            image.localUri,
            projectId
          );

          newlyUploadedPaths.push(uploaded.path);
          finalImageUrls.push(uploaded.url);
        } else if (image.image_url) {
          finalImageUrls.push(image.image_url);
        }
      }

      const { error: imageUpdateError } = await supabase
        .from('projects')
        .update({
          image_urls: finalImageUrls,
          updated_at: new Date().toISOString(),
        })
        .eq('id', projectId);

      if (imageUpdateError) throw imageUpdateError;

      const retainedUrls = new Set(finalImageUrls);

      const removedPaths = (editingProject?.image_urls || [])
        .filter((url) => !retainedUrls.has(url))
        .map((url) => getStoragePath(url))
        .filter((path): path is string => Boolean(path));

      let cleanupWarning = false;

      if (removedPaths.length > 0) {
        try {
          await removeStorageFiles(removedPaths);
        } catch {
          cleanupWarning = true;
        }
      }

      setFormVisible(false);
      setEditingProject(null);
      setGalleryImages([]);

      await loadProjects(false);

      Alert.alert(
        editingProject ? 'Project updated' : 'Project created',
        cleanupWarning
          ? 'The project was saved, but one or more removed photographs could not be deleted from Storage.'
          : editingProject
            ? 'Your project information and photographs have been saved.'
            : 'Your new project and photographs have been saved.'
      );
    } catch (error: any) {
      if (newlyUploadedPaths.length > 0) {
        try {
          await removeStorageFiles(newlyUploadedPaths);
        } catch {
          // Preserve the original save error.
        }
      }

      Alert.alert(
        'Could not save project',
        error?.message ||
          'Check your administrator permissions and Supabase configuration.'
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteProject = (project: Project) => {
    Alert.alert(
      'Delete project?',
      `Are you sure you want to delete "${project.title}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', project.id);

              if (error) throw error;

              setProjects((current) =>
                current.filter((item) => item.id !== project.id)
              );

              const paths = (project.image_urls || [])
                .map((url) => getStoragePath(url))
                .filter((path): path is string => Boolean(path));

              try {
                await removeStorageFiles(paths);
              } catch {
                Alert.alert(
                  'Project deleted',
                  'The project was deleted, but some photographs could not be removed from Storage.'
                );
                return;
              }

              Alert.alert(
                'Project deleted',
                'The project and its photographs have been removed.'
              );
            } catch (error: any) {
              Alert.alert(
                'Delete failed',
                error?.message ||
                  'Only an authorised administrator can delete projects.'
              );
            }
          },
        },
      ]
    );
  };

  const filteredProjects = projects.filter((project) => {
    const searchText = search.trim().toLowerCase();

    const matchesSearch =
      !searchText ||
      project.title.toLowerCase().includes(searchText) ||
      (project.community || '').toLowerCase().includes(searchText) ||
      (project.description || '').toLowerCase().includes(searchText);

    const matchesFilter =
      filter === 'all' || project.status === filter;

    return matchesSearch && matchesFilter;
  });

  const ongoingCount = projects.filter(
    (project) => project.status === 'ongoing'
  ).length;

  const completedCount = projects.filter(
    (project) => project.status === 'completed'
  ).length;

  const plannedCount = projects.filter(
    (project) => project.status === 'planned'
  ).length;

  const toggleFilter = (status: FilterStatus) => {
    setFilter((current) => current === status ? 'all' : status);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadProjects(false);
            }}
            tintColor={GREEN}
          />
        }
      >
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.eyebrow}>ADMINISTRATION</Text>
            <Text style={styles.heading}>Projects & Development</Text>
            <Text style={styles.subtitle}>
              Manage public projects and community development.
            </Text>
          </View>

          <Pressable style={styles.addButton} onPress={openAddForm}>
            <Text style={styles.addButtonText}>+ Add</Text>
          </Pressable>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>TOTAL PROJECTS</Text>
          <Text style={styles.summaryNumber}>{projects.length}</Text>
          <Text style={styles.summaryDescription}>
            Projects recorded in the local government database
          </Text>

          <Pressable
            onPress={() => setFilter('all')}
            style={styles.viewAllLink}
          >
            <Text style={styles.viewAllText}>View all projects</Text>
          </Pressable>
        </View>

        <View style={styles.statsRow}>
          {[
            { label: 'Ongoing', value: 'ongoing' as FilterStatus, count: ongoingCount, color: '#2B9660' },
            { label: 'Completed', value: 'completed' as FilterStatus, count: completedCount, color: '#397FC0' },
            { label: 'Planned', value: 'planned' as FilterStatus, count: plannedCount, color: '#D39A35' },
          ].map((item) => (
            <Pressable
              key={item.value}
              onPress={() => toggleFilter(item.value)}
              style={[
                styles.statCard,
                filter === item.value && styles.statCardSelected,
              ]}
            >
              <View style={[styles.statDot, { backgroundColor: item.color }]} />
              <Text style={styles.statNumber}>{item.count}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
              {filter === item.value ? (
                <Text style={styles.statHint}>Selected</Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.searchIcon}>⌕</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search projects or communities"
            placeholderTextColor="#89958E"
            style={styles.searchInput}
            returnKeyType="search"
          />
        </View>

        <Text style={styles.sectionTitle}>Project status</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {[
            { label: 'All projects', value: 'all' as FilterStatus },
            { label: 'Planned', value: 'planned' as FilterStatus },
            { label: 'Ongoing', value: 'ongoing' as FilterStatus },
            { label: 'Completed', value: 'completed' as FilterStatus },
            { label: 'Suspended', value: 'suspended' as FilterStatus },
          ].map((item) => {
            const selected = filter === item.value;

            return (
              <Pressable
                key={item.value}
                onPress={() => setFilter(item.value)}
                style={[
                  styles.filterChip,
                  selected && styles.filterChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.filterText,
                    selected && styles.filterTextSelected,
                  ]}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.listHeadingRow}>
          <Text style={styles.sectionTitle}>
            {filter === 'all' ? 'All projects' : `${getStatus(filter).label} projects`}
          </Text>
          <Text style={styles.resultCount}>{filteredProjects.length} found</Text>
        </View>

        {loading ? (
          <View style={styles.stateBox}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={styles.stateText}>Loading projects...</Text>
          </View>
        ) : filteredProjects.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>▤</Text>
            <Text style={styles.emptyTitle}>
              {projects.length === 0 ? 'No projects yet' : 'No matching projects'}
            </Text>
            <Text style={styles.emptyDescription}>
              {projects.length === 0
                ? 'Add a project to begin tracking development in your communities.'
                : 'Try another search term or choose a different status filter.'}
            </Text>

            <Pressable
              style={styles.emptyButton}
              onPress={() => {
                if (projects.length === 0) {
                  openAddForm();
                } else {
                  setFilter('all');
                  setSearch('');
                }
              }}
            >
              <Text style={styles.emptyButtonText}>
                {projects.length === 0 ? 'Add first project' : 'Clear filters'}
              </Text>
            </Pressable>
          </View>
        ) : (
          filteredProjects.map((project) => {
            const status = getStatus(project.status);
            const progress = Math.max(0, Math.min(100, project.progress ?? 0));
            const mainImage = project.image_urls?.[0];

            return (
              <View key={project.id} style={styles.projectCard}>
                {mainImage ? (
                  <Image
                    source={{ uri: mainImage }}
                    style={styles.projectImage}
                    resizeMode="cover"
                  />
                ) : null}

                <View style={styles.projectTopRow}>
                  <View style={styles.projectIcon}>
                    <Text style={styles.projectIconText}>⌂</Text>
                  </View>

                  <View style={styles.projectMain}>
                    <Text style={styles.projectTitle}>{project.title}</Text>
                    <Text style={styles.projectCommunity}>
                      {project.community || 'Community not specified'}
                    </Text>
                  </View>
                </View>

                {project.description ? (
                  <Text style={styles.projectDescription} numberOfLines={3}>
                    {project.description}
                  </Text>
                ) : null}

                <View style={styles.projectMetaRow}>
                  <View style={[styles.statusBadge, { backgroundColor: status.background }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>
                      {status.label}
                    </Text>
                  </View>

                  <Text style={styles.progressLabel}>{progress}% complete</Text>
                </View>

                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progress}%` }]} />
                </View>

                <View style={styles.dateRow}>
                  <View style={styles.dateColumn}>
                    <Text style={styles.dateLabel}>START DATE</Text>
                    <Text style={styles.dateValue}>
                      {formatDate(project.start_date)}
                    </Text>
                  </View>
                  <View style={styles.dateColumn}>
                    <Text style={styles.dateLabel}>EXPECTED FINISH</Text>
                    <Text style={styles.dateValue}>
                      {formatDate(project.expected_completion_date)}
                    </Text>
                  </View>
                </View>

                <View style={styles.publicationRow}>
                  <Text style={styles.publicationText}>
                    {project.is_published ? 'Published to citizens' : 'Draft — not public'}
                  </Text>
                  <Text style={styles.photoCount}>
                    {project.image_urls?.length || 0} photos
                  </Text>
                </View>

                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.editButton}
                    onPress={() => openEditForm(project)}
                  >
                    <Text style={styles.editButtonText}>Edit project</Text>
                  </Pressable>

                  <Pressable
                    style={styles.deleteButton}
                    onPress={() => deleteProject(project)}
                  >
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.footer}>
          Igbo-Eze-North Local Government Administration
        </Text>
      </ScrollView>

      <Modal
        visible={formVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeForm}
      >
        <KeyboardAvoidingView
          style={styles.modalScreen}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.modalHeader}>
            <View style={styles.modalHeadingContainer}>
              <Text style={styles.modalTitle}>
                {editingProject ? 'Edit project' : 'New project'}
              </Text>
              <Text style={styles.modalSubtitle}>
                Enter the project information below.
              </Text>
            </View>

            <Pressable
              onPress={closeForm}
              disabled={saving}
              style={styles.closeButton}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.formScroll}
            contentContainerStyle={styles.formContent}
            keyboardShouldPersistTaps="handled"
          >
            <Field
              label="Project title *"
              value={form.title}
              onChangeText={(value) => updateForm('title', value)}
              placeholder="e.g. Community road rehabilitation"
            />

            <Field
              label="Community *"
              value={form.community}
              onChangeText={(value) => updateForm('community', value)}
              placeholder="Enter the project community"
            />

            <Field
              label="Description"
              value={form.description}
              onChangeText={(value) => updateForm('description', value)}
              placeholder="Describe the project and its purpose"
              multiline
            />

            <View style={styles.twoColumns}>
              <View style={styles.halfField}>
                <Field
                  label="Start date"
                  value={form.start_date}
                  onChangeText={(value) => updateForm('start_date', value)}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                  helper="Example: 2026-10-30"
                />
              </View>

              <View style={styles.halfField}>
                <Field
                  label="Expected finish"
                  value={form.expected_completion_date}
                  onChangeText={(value) => updateForm('expected_completion_date', value)}
                  placeholder="YYYY-MM-DD"
                  keyboardType="numbers-and-punctuation"
                  helper="Example: 2027-03-15"
                />
              </View>
            </View>

            <Field
              label="Progress (%)"
              value={form.progress}
              onChangeText={(value) => updateForm('progress', value)}
              placeholder="0 to 100"
              keyboardType="numeric"
              helper="Enter a whole number between 0 and 100."
            />

            <Text style={styles.fieldLabel}>Project status</Text>

            <View style={styles.statusOptions}>
              {STATUS_OPTIONS.map((item) => {
                const selected = form.status === item.value;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => updateForm('status', item.value)}
                    style={[
                      styles.statusOption,
                      selected && {
                        borderColor: item.color,
                        backgroundColor: item.background,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusOptionText,
                        selected && { color: item.color },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.publicationCard}>
              <View style={styles.publicationCopy}>
                <Text style={styles.fieldLabel}>Publish project</Text>
                <Text style={styles.helper}>
                  Published projects can be displayed in the Citizen app. Turn this off to keep the project as a draft.
                </Text>
              </View>
              <Switch
                value={form.is_published}
                onValueChange={(value) => updateForm('is_published', value)}
                trackColor={{ false: '#D5DDD8', true: '#9BCDB0' }}
                thumbColor={form.is_published ? GREEN : '#F4F4F4'}
              />
            </View>

            <View style={styles.field}>
              <View style={styles.galleryHeading}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Project photographs</Text>
                  <Text style={styles.helper}>
                    Add up to {MAX_IMAGES} photographs. The first photograph will be the main project image.
                  </Text>
                </View>

                <Text style={styles.imageCount}>
                  {galleryImages.length}/{MAX_IMAGES}
                </Text>
              </View>

              {galleryImages.length > 0 ? (
                <View style={styles.galleryGrid}>
                  {galleryImages.map((image, index) => (
                    <View
                      key={image.localUri || image.image_url || `image-${index}`}
                      style={styles.galleryItem}
                    >
                      <Image
                        source={{
                          uri: image.localUri || image.image_url,
                        }}
                        style={styles.galleryImage}
                        resizeMode="cover"
                      />

                      {index === 0 ? (
                        <View style={styles.mainImageBadge}>
                          <Text style={styles.mainImageBadgeText}>MAIN PHOTO</Text>
                        </View>
                      ) : null}

                      {image.isNew ? (
                        <View style={styles.newImageBadge}>
                          <Text style={styles.newImageBadgeText}>NEW</Text>
                        </View>
                      ) : null}

                      <Pressable
                        style={styles.removeImageButton}
                        onPress={() => removeGalleryImage(index)}
                        disabled={saving}
                      >
                        <Text style={styles.removeImageText}>×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={styles.imagePlaceholder}>
                  <Text style={styles.imagePlaceholderIcon}>▧</Text>
                  <Text style={styles.imagePlaceholderText}>
                    No project photographs selected
                  </Text>
                </View>
              )}

              <Pressable
                style={styles.chooseImageButton}
                onPress={chooseProjectImages}
                disabled={saving || galleryImages.length >= MAX_IMAGES}
              >
                <Text style={styles.chooseImageButtonText}>
                  {galleryImages.length > 0
                    ? '＋ Add more photographs'
                    : '＋ Choose photographs from device'}
                </Text>
              </Pressable>

              <Text style={styles.helper}>
                You can remove individual photographs using the × button. Changes take effect when you save.
              </Text>
            </View>

            <View style={styles.formNote}>
              <Text style={styles.formNoteText}>
                * Required fields. Use YYYY-MM-DD for dates, for example 2026-10-30.
              </Text>
            </View>

            <Pressable
              style={[styles.saveButton, saving && styles.saveButtonDisabled]}
              onPress={saveProject}
              disabled={saving}
            >
              {saving ? (
                <View style={styles.savingRow}>
                  <ActivityIndicator color={WHITE} />
                  <Text style={styles.saveButtonText}>
                    Saving project and photographs...
                  </Text>
                </View>
              ) : (
                <Text style={styles.saveButtonText}>
                  {editingProject ? 'Save changes' : 'Create project'}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.cancelButton}
              onPress={closeForm}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BACKGROUND },
  page: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 22,
  },
  headerText: { flex: 1 },
  eyebrow: {
    color: GREEN,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 7,
  },
  heading: { color: TEXT, fontSize: 25, fontWeight: '800', lineHeight: 31 },
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 20, marginTop: 7 },
  addButton: {
    backgroundColor: GREEN,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 18,
  },
  addButtonText: { color: WHITE, fontSize: 13, fontWeight: '800' },
  summaryCard: {
    backgroundColor: DARK_GREEN,
    padding: 22,
    borderRadius: 20,
    marginBottom: 14,
  },
  summaryLabel: { color: '#C6E7D2', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  summaryNumber: { color: WHITE, fontSize: 38, fontWeight: '800', marginTop: 7 },
  summaryDescription: { color: '#D8E9DE', fontSize: 12, lineHeight: 18, marginTop: 5 },
  viewAllLink: { alignSelf: 'flex-start', marginTop: 12, paddingVertical: 5 },
  viewAllText: { color: WHITE, fontSize: 12, fontWeight: '800', textDecorationLine: 'underline' },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 23 },
  statCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderRadius: 15,
    padding: 13,
    borderWidth: 1,
    borderColor: BORDER,
  },
  statCardSelected: { borderColor: GREEN, borderWidth: 2, backgroundColor: LIGHT_GREEN },
  statDot: { width: 8, height: 8, borderRadius: 4, marginBottom: 9 },
  statNumber: { color: TEXT, fontSize: 23, fontWeight: '800' },
  statLabel: { color: MUTED, fontSize: 11, marginTop: 4 },
  statHint: { color: GREEN, fontSize: 9, fontWeight: '800', marginTop: 5 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 13,
    paddingHorizontal: 13,
    marginBottom: 22,
  },
  searchIcon: { fontSize: 25, color: GREEN, marginRight: 9 },
  searchInput: { flex: 1, minHeight: 48, color: TEXT, fontSize: 13 },
  sectionTitle: { color: TEXT, fontSize: 16, fontWeight: '800' },
  filterRow: { gap: 8, paddingVertical: 13 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  filterChipSelected: { backgroundColor: GREEN, borderColor: GREEN },
  filterText: { color: MUTED, fontSize: 12, fontWeight: '600' },
  filterTextSelected: { color: WHITE },
  listHeadingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 7,
    marginBottom: 13,
  },
  resultCount: { color: MUTED, fontSize: 12 },
  stateBox: { paddingVertical: 45, alignItems: 'center', gap: 12 },
  stateText: { color: MUTED, fontSize: 13 },
  emptyCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 27,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyIcon: { color: GREEN, fontSize: 35, marginBottom: 10 },
  emptyTitle: { color: TEXT, fontSize: 17, fontWeight: '800' },
  emptyDescription: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  emptyButton: { backgroundColor: GREEN, borderRadius: 11, paddingHorizontal: 17, paddingVertical: 12, marginTop: 18 },
  emptyButtonText: { color: WHITE, fontWeight: '700', fontSize: 13 },
  projectCard: {
    backgroundColor: WHITE,
    borderRadius: 18,
    padding: 17,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  projectImage: { width: '100%', height: 175, borderRadius: 13, marginBottom: 15, backgroundColor: '#E9EFEB' },
  projectTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  projectIcon: { width: 45, height: 45, borderRadius: 13, backgroundColor: LIGHT_GREEN, alignItems: 'center', justifyContent: 'center' },
  projectIconText: { color: GREEN, fontSize: 25, fontWeight: '700' },
  projectMain: { flex: 1 },
  projectTitle: { color: TEXT, fontSize: 15, fontWeight: '800', lineHeight: 21 },
  projectCommunity: { color: GREEN, fontSize: 12, marginTop: 4, fontWeight: '600' },
  projectDescription: { color: MUTED, fontSize: 12, lineHeight: 19, marginTop: 14 },
  projectMetaRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 17, marginBottom: 10 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },
  progressLabel: { color: MUTED, fontSize: 11, fontWeight: '700' },
  progressTrack: { height: 7, borderRadius: 10, backgroundColor: '#E8EEEA', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: GREEN, borderRadius: 10 },
  dateRow: { flexDirection: 'row', gap: 12, marginTop: 17, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#EDF0EE' },
  dateColumn: { flex: 1 },
  dateLabel: { color: '#89958E', fontSize: 9, fontWeight: '800', letterSpacing: 0.6 },
  dateValue: { color: TEXT, fontSize: 12, fontWeight: '600', marginTop: 6 },
  publicationRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
  },
  publicationText: { color: GREEN, fontSize: 11, fontWeight: '700' },
  photoCount: { color: MUTED, fontSize: 11 },
  cardActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  editButton: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 10, backgroundColor: LIGHT_GREEN },
  editButtonText: { color: GREEN, fontSize: 12, fontWeight: '800' },
  deleteButton: { alignItems: 'center', paddingVertical: 11, paddingHorizontal: 17, borderRadius: 10, backgroundColor: '#FCEDEC' },
  deleteButtonText: { color: '#B63830', fontSize: 12, fontWeight: '800' },
  modalScreen: { flex: 1, backgroundColor: BACKGROUND },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: WHITE,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  modalHeadingContainer: { flex: 1 },
  modalTitle: { color: TEXT, fontSize: 21, fontWeight: '800' },
  modalSubtitle: { color: MUTED, fontSize: 12, marginTop: 5 },
  closeButton: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#EFF3F0', alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  closeButtonText: { color: TEXT, fontSize: 27, lineHeight: 30 },
  formScroll: { flex: 1 },
  formContent: { padding: 20, paddingBottom: 35 },
  field: { marginBottom: 18 },
  fieldLabel: { color: TEXT, fontSize: 12, fontWeight: '800', marginBottom: 8 },
  input: { minHeight: 48, borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11, fontSize: 13, color: TEXT },
  multilineInput: { minHeight: 100 },
  helper: { color: MUTED, fontSize: 11, lineHeight: 16, marginTop: 6 },
  twoColumns: { flexDirection: 'row', gap: 12 },
  halfField: { flex: 1 },
  statusOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3, marginBottom: 20 },
  statusOption: { borderWidth: 1, borderColor: BORDER, backgroundColor: WHITE, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10 },
  statusOptionText: { color: MUTED, fontSize: 12, fontWeight: '700' },
  publicationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  publicationCopy: { flex: 1 },
  galleryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  imageCount: { color: GREEN, fontSize: 12, fontWeight: '800' },
  galleryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  galleryItem: { width: '48%', height: 125, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E9EFEB' },
  galleryImage: { width: '100%', height: '100%' },
  mainImageBadge: { position: 'absolute', left: 6, bottom: 6, backgroundColor: DARK_GREEN, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5 },
  mainImageBadgeText: { color: WHITE, fontSize: 8, fontWeight: '800' },
  newImageBadge: { position: 'absolute', left: 6, top: 6, backgroundColor: '#2766A5', paddingHorizontal: 7, paddingVertical: 5, borderRadius: 5 },
  newImageBadgeText: { color: WHITE, fontSize: 8, fontWeight: '800' },
  removeImageButton: { position: 'absolute', right: 6, top: 6, width: 27, height: 27, borderRadius: 14, backgroundColor: '#B63830', alignItems: 'center', justifyContent: 'center' },
  removeImageText: { color: WHITE, fontSize: 20, lineHeight: 23, fontWeight: '700' },
  imagePlaceholder: { height: 130, borderRadius: 12, borderWidth: 1, borderColor: BORDER, borderStyle: 'dashed', backgroundColor: WHITE, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  imagePlaceholderIcon: { color: GREEN, fontSize: 30, marginBottom: 5 },
  imagePlaceholderText: { color: MUTED, fontSize: 12 },
  chooseImageButton: { backgroundColor: LIGHT_GREEN, borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  chooseImageButtonText: { color: GREEN, fontSize: 12, fontWeight: '800' },
  formNote: { backgroundColor: LIGHT_GREEN, padding: 12, borderRadius: 10, marginBottom: 18 },
  formNoteText: { color: DARK_GREEN, fontSize: 11, lineHeight: 17 },
  saveButton: { backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center', minHeight: 50, borderRadius: 12, paddingHorizontal: 12 },
  saveButtonDisabled: { opacity: 0.65 },
  saveButtonText: { color: WHITE, fontSize: 13, fontWeight: '800' },
  savingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  cancelButton: { alignItems: 'center', paddingVertical: 15, marginTop: 4 },
  cancelButtonText: { color: MUTED, fontSize: 13, fontWeight: '700' },
  footer: { color: '#8A958E', textAlign: 'center', fontSize: 10, marginTop: 20 },
});
