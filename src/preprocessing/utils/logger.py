# Copyright (c) 2025-2026 Thales Services Numeriques (TSN).
#
# This file is part of Air3Dex
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from rich.console import Console

RESET = "\033[0m"
BOLD = "\033[1m"
RED = "\033[31m"
GREEN = "\033[32m"
YELLOW = "\033[33m"
BLUE = "\033[34m"
CYAN = "\033[36m"
MAGENTA = "\033[35m"

console = Console()


def log_separate(msg, color):
    console.rule(f"\n[bold {color}] {msg.upper()}")


def log_analyse(msg):
    print(f"\n{MAGENTA}{BOLD}[Analyse]{RESET} {msg}")


def log_export(msg):
    print(f"\n{GREEN}{BOLD}[Export]{RESET} {msg}")


def log_plot(msg):
    print(f"\n{CYAN}{BOLD}[Plot]{RESET} {msg}")


def log_warn(msg):
    print(f"\n{YELLOW}{BOLD}[⚠️ WARN]{RESET} {msg}")


def log_error(msg):
    print(f"\n{RED}{BOLD}[❌ ERROR]{RESET} {msg}")
