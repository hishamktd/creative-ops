# Test Fixtures

This directory contains test files used in E2E tests.

## Files

- `test-image.jpg` - Small test image (1KB)
- `test-image-1.jpg` - Test image variant 1
- `test-image-2.png` - Test image in PNG format
- `test-document.pdf` - Small PDF document
- `large-video.mp4` - Large video file for testing upload progress
- `malware.exe` - Fake executable for testing file validation

## Usage

These files are used by Playwright E2E tests to simulate real file uploads and interactions.

## Note

The actual binary files are not included in the repository. In a real implementation, you would:

1. Generate these files programmatically in the test setup
2. Use actual small test files
3. Create them as part of the CI/CD pipeline

For now, the tests will need to be updated to either:
- Generate test files dynamically
- Use data URLs for small files
- Mock the file upload process