"""Run on the ASR host to issue an access token valid for one hour.

The signing secret stays on the server. Give only the issued token to a tester.
"""
import os
import sys
from asr_app import issue_token

if __name__ == "__main__":
    token = issue_token(os.environ.get("ASR_SIGNING_SECRET", ""), sys.argv[1] if len(sys.argv) > 1 else "operator")
    print(token)
