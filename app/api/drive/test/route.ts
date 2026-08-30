import { NextRequest, NextResponse } from 'next/server'
import { setCredentials } from '@/lib/oauth/google-auth'
import {
  listFolderContents,
  createFolder,
  uploadFile,
  readFile,
  moveFile,
  deleteFile,
} from '@/lib/oauth/google-drive'

// The test runs a sequence: list → create folder A → create folder B → upload file → read → move → verify file_id → cleanup
export async function POST(request: NextRequest) {
  try {
    // Get refresh_token from env (it will be there after OAuth2 callback)
    const refreshToken = process.env.GOOGLE_OAUTH_REFRESH_TOKEN
    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token not found. Please authorize first at /api/auth/google/authorize' },
        { status: 401 }
      )
    }

    // Set credentials to use the stored refresh_token
    setCredentials({ refresh_token: refreshToken })

    const testResults: any = {}
    const ENTRADA_FOLDER_ID = process.env.GOOGLE_DRIVE_TEST_FOLDER_ID // The FACTURAS/ENTRADA folder

    // Step 1: List ENTRADA folder
    testResults.step1_list = {
      action: 'List FACTURAS/ENTRADA',
      status: 'running',
    }
    const entradaFiles = await listFolderContents(ENTRADA_FOLDER_ID!)
    testResults.step1_list = {
      action: 'List FACTURAS/ENTRADA',
      status: 'ok',
      filesFound: entradaFiles.length,
    }

    // Step 2: Create test folder A
    testResults.step2_createFolderA = {
      action: 'Create folder A',
      status: 'running',
    }
    const folderA = await createFolder(
      `clinicos-test-oauth2-A-${Date.now()}`,
      ENTRADA_FOLDER_ID!
    )
    testResults.step2_createFolderA = {
      action: 'Create folder A',
      status: 'ok',
      folderId: folderA.id,
    }

    // Step 3: Create test folder B
    testResults.step3_createFolderB = {
      action: 'Create folder B',
      status: 'running',
    }
    const folderB = await createFolder(
      `clinicos-test-oauth2-B-${Date.now()}`,
      ENTRADA_FOLDER_ID!
    )
    testResults.step3_createFolderB = {
      action: 'Create folder B',
      status: 'ok',
      folderId: folderB.id,
    }

    // Step 4: Upload file to folder A
    testResults.step4_uploadFile = {
      action: 'Upload file to folder A',
      status: 'running',
    }
    const testFile = await uploadFile(
      `clinicos-test-oauth2-${Date.now()}.txt`,
      'OAuth2 test file - ClinicOS',
      folderA.id!
    )
    const originalFileId = testFile.id
    testResults.step4_uploadFile = {
      action: 'Upload file to folder A',
      status: 'ok',
      fileId: originalFileId,
    }

    // Step 5: Read file
    testResults.step5_readFile = {
      action: 'Read file',
      status: 'running',
    }
    const fileContent = await readFile(originalFileId!)
    testResults.step5_readFile = {
      action: 'Read file',
      status: 'ok',
      content: fileContent,
    }

    // Step 6: Move file from A to B
    testResults.step6_moveFile = {
      action: 'Move file from A to B',
      status: 'running',
    }
    const movedFile = await moveFile(originalFileId!, folderB.id!, folderA.id!)
    testResults.step6_moveFile = {
      action: 'Move file from A to B',
      status: 'ok',
      movedFileId: movedFile.id,
    }

    // Step 7: Verify file_id is unchanged
    testResults.step7_verifyFileId = {
      action: 'Verify file_id unchanged',
      status: 'running',
    }
    const fileIdUnchanged = movedFile.id === originalFileId
    testResults.step7_verifyFileId = {
      action: 'Verify file_id unchanged',
      status: 'ok',
      originalFileId,
      currentFileId: movedFile.id,
      unchanged: fileIdUnchanged,
    }

    // Step 8: Cleanup - delete file
    testResults.step8_deleteFile = {
      action: 'Delete file',
      status: 'running',
    }
    await deleteFile(originalFileId!)
    testResults.step8_deleteFile = {
      action: 'Delete file',
      status: 'ok',
    }

    // Step 9: Cleanup - delete folder A
    testResults.step9_deleteFolderA = {
      action: 'Delete folder A',
      status: 'running',
    }
    await deleteFile(folderA.id!)
    testResults.step9_deleteFolderA = {
      action: 'Delete folder A',
      status: 'ok',
    }

    // Step 10: Cleanup - delete folder B
    testResults.step10_deleteFolderB = {
      action: 'Delete folder B',
      status: 'running',
    }
    await deleteFile(folderB.id!)
    testResults.step10_deleteFolderB = {
      action: 'Delete folder B',
      status: 'ok',
    }

    return NextResponse.json({
      success: true,
      message: 'OAuth2 + Google Drive test completed successfully',
      results: testResults,
    })
  } catch (error) {
    console.error('Error in Drive test:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
