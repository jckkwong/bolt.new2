import { promises as fs } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

/**
 * Interface for the manifest file structure
 * Tracks file signatures and metadata for change detection
 */
interface DocumentManifest {
  /** Timestamp when the manifest was last updated */
  lastUpdated: string;
  /** Map of file paths to their SHA256 hashes */
  files: Record<string, string>;
  /** Total number of files tracked */
  fileCount: number;
  /** Version of the manifest format */
  version: string;
}

/**
 * Configuration constants for the ingestion process
 */
const CONFIG = {
  /** Directory containing the documents to process */
  DOCUMENTS_DIR: path.join(process.cwd(), 'public', 'documents'),
  /** Path to the manifest file for tracking changes */
  MANIFEST_PATH: path.join(process.cwd(), '.manifest.json'),
  /** Supported file extensions for processing */
  SUPPORTED_EXTENSIONS: ['.pdf', '.docx', '.txt', '.md'],
  /** Current version of the manifest format */
  MANIFEST_VERSION: '1.0.0'
} as const;

/**
 * Calculates the SHA256 hash of a file's content
 * @param filePath - Absolute path to the file
 * @returns Promise resolving to the hex-encoded SHA256 hash
 */
async function calculateFileHash(filePath: string): Promise<string> {
  try {
    const fileBuffer = await fs.readFile(filePath);
    const hash = createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  } catch (error) {
    throw new Error(`Failed to calculate hash for ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Reads and parses the existing manifest file
 * @returns Promise resolving to the parsed manifest or null if file doesn't exist
 */
async function readManifest(): Promise<DocumentManifest | null> {
  try {
    const manifestContent = await fs.readFile(CONFIG.MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(manifestContent) as DocumentManifest;
    
    // Validate manifest structure
    if (!manifest.files || typeof manifest.files !== 'object') {
      console.warn('WARN: Invalid manifest structure detected. Will rebuild.');
      return null;
    }
    
    console.log(`INFO: Loaded existing manifest with ${manifest.fileCount} tracked files`);
    return manifest;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log('INFO: No existing manifest found. This appears to be the first run.');
      return null;
    }
    console.warn(`WARN: Failed to read manifest: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

/**
 * Writes the updated manifest file to disk
 * @param manifest - The manifest object to write
 */
async function writeManifest(manifest: DocumentManifest): Promise<void> {
  try {
    const manifestJson = JSON.stringify(manifest, null, 2);
    await fs.writeFile(CONFIG.MANIFEST_PATH, manifestJson, 'utf-8');
    console.log(`SUCCESS: Updated manifest with ${manifest.fileCount} files`);
  } catch (error) {
    throw new Error(`Failed to write manifest: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Scans the documents directory and returns all supported files
 * @returns Promise resolving to an array of absolute file paths
 */
async function scanDocumentsDirectory(): Promise<string[]> {
  try {
    // Check if documents directory exists
    await fs.access(CONFIG.DOCUMENTS_DIR);
    
    const entries = await fs.readdir(CONFIG.DOCUMENTS_DIR, { withFileTypes: true });
    
    const supportedFiles = entries
      .filter(entry => entry.isFile())
      .map(entry => entry.name)
      .filter(filename => {
        const ext = path.extname(filename).toLowerCase();
        return CONFIG.SUPPORTED_EXTENSIONS.includes(ext);
      })
      .map(filename => path.join(CONFIG.DOCUMENTS_DIR, filename));
    
    console.log(`INFO: Found ${supportedFiles.length} supported documents in ${CONFIG.DOCUMENTS_DIR}`);
    
    if (supportedFiles.length === 0) {
      console.warn('WARN: No supported documents found. Supported extensions:', CONFIG.SUPPORTED_EXTENSIONS.join(', '));
    }
    
    return supportedFiles;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Documents directory not found: ${CONFIG.DOCUMENTS_DIR}`);
    }
    throw new Error(`Failed to scan documents directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculates hashes for all files in the provided list
 * @param filePaths - Array of absolute file paths
 * @returns Promise resolving to a map of relative paths to their hashes
 */
async function calculateCurrentHashes(filePaths: string[]): Promise<Record<string, string>> {
  const currentHashes: Record<string, string> = {};
  
  console.log('INFO: Calculating file hashes...');
  
  for (const filePath of filePaths) {
    try {
      const relativePath = path.relative(CONFIG.DOCUMENTS_DIR, filePath);
      const hash = await calculateFileHash(filePath);
      currentHashes[relativePath] = hash;
      console.log(`  ✓ ${relativePath}: ${hash.substring(0, 12)}...`);
    } catch (error) {
      console.error(`  ✗ Failed to hash ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw error;
    }
  }
  
  return currentHashes;
}

/**
 * Compares current file hashes with the previous manifest
 * @param currentHashes - Current file hashes
 * @param previousManifest - Previous manifest (null if first run)
 * @returns Object indicating if changes were detected and details about the changes
 */
function detectChanges(
  currentHashes: Record<string, string>, 
  previousManifest: DocumentManifest | null
): { hasChanges: boolean; details: string[] } {
  const details: string[] = [];
  
  if (!previousManifest) {
    details.push('First run detected - no previous manifest exists');
    return { hasChanges: true, details };
  }
  
  const previousHashes = previousManifest.files;
  const currentFiles = new Set(Object.keys(currentHashes));
  const previousFiles = new Set(Object.keys(previousHashes));
  
  // Check for added files
  const addedFiles = [...currentFiles].filter(file => !previousFiles.has(file));
  addedFiles.forEach(file => details.push(`Added: ${file}`));
  
  // Check for removed files
  const removedFiles = [...previousFiles].filter(file => !currentFiles.has(file));
  removedFiles.forEach(file => details.push(`Removed: ${file}`));
  
  // Check for modified files
  const modifiedFiles = [...currentFiles]
    .filter(file => previousFiles.has(file))
    .filter(file => currentHashes[file] !== previousHashes[file]);
  modifiedFiles.forEach(file => details.push(`Modified: ${file}`));
  
  const hasChanges = addedFiles.length > 0 || removedFiles.length > 0 || modifiedFiles.length > 0;
  
  if (!hasChanges) {
    details.push('No changes detected - all files match previous manifest');
  }
  
  return { hasChanges, details };
}

/**
 * Placeholder function for rebuilding the vector database
 * This will be replaced with actual vector database logic later
 */
async function rebuildVectorDB(): Promise<void> {
  console.log('ACTION: Rebuilding vector database...');
  console.log('  - Parsing document content...');
  
  // Simulate parsing delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('  - Generating embeddings...');
  
  // Simulate embedding generation delay
  await new Promise(resolve => setTimeout(resolve, 1500));
  
  console.log('  - Storing vectors...');
  
  // Simulate storage delay
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('SUCCESS: Vector database rebuilt successfully');
}

/**
 * Main execution function
 * Orchestrates the entire document ingestion and change detection process
 */
async function main(): Promise<void> {
  console.log('='.repeat(60));
  console.log('🚀 Starting intelligent document ingestion process');
  console.log('='.repeat(60));
  
  try {
    // Step 1: Read existing manifest
    console.log('\n📋 Step 1: Reading existing manifest...');
    const previousManifest = await readManifest();
    
    // Step 2: Scan documents directory
    console.log('\n📁 Step 2: Scanning documents directory...');
    const documentFiles = await scanDocumentsDirectory();
    
    if (documentFiles.length === 0) {
      console.log('INFO: No documents to process. Exiting.');
      return;
    }
    
    // Step 3: Calculate current file hashes
    console.log('\n🔍 Step 3: Calculating file signatures...');
    const currentHashes = await calculateCurrentHashes(documentFiles);
    
    // Step 4: Detect changes
    console.log('\n🔄 Step 4: Detecting changes...');
    const { hasChanges, details } = detectChanges(currentHashes, previousManifest);
    
    console.log('\nChange Detection Results:');
    details.forEach(detail => console.log(`  • ${detail}`));
    
    // Step 5: Conditional execution based on changes
    if (!hasChanges) {
      console.log('\n✅ INFO: Documents are up to date. No changes detected.');
      console.log('Exiting without rebuilding vector database.');
      return;
    }
    
    console.log('\n🔧 Changes detected! Proceeding with vector database rebuild...');
    
    // Step 6: Rebuild vector database
    await rebuildVectorDB();
    
    // Step 7: Update manifest
    console.log('\n💾 Updating manifest...');
    const newManifest: DocumentManifest = {
      lastUpdated: new Date().toISOString(),
      files: currentHashes,
      fileCount: Object.keys(currentHashes).length,
      version: CONFIG.MANIFEST_VERSION
    };
    
    await writeManifest(newManifest);
    
    console.log('\n🎉 Document ingestion completed successfully!');
    
  } catch (error) {
    console.error('\n❌ ERROR: Document ingestion failed');
    console.error(error instanceof Error ? error.message : 'Unknown error occurred');
    process.exit(1);
  }
  
  console.log('='.repeat(60));
}

// Execute the main function if this script is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('FATAL ERROR:', error);
    process.exit(1);
  });
}

// Export functions for potential use in other modules
export {
  calculateFileHash,
  readManifest,
  writeManifest,
  scanDocumentsDirectory,
  calculateCurrentHashes,
  detectChanges,
  rebuildVectorDB,
  main
};