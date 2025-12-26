#!/bin/bash
df -h 2>/dev/null | grep -v '^Filesystem' | grep -v 'tmpfs\|devfs\|map auto_home' | head -15 | while read -r line; do
    # Parse line - handle both Linux (6 cols) and macOS (9 cols) formats
    set -- $line
    filesystem="$1"
    size="$2"
    used="$3"
    avail="$4"

    # For Linux: Use% is $5, Mount is $6
    # For macOS: Capacity is $5, iused=$6, ifree=$7, %iused=$8, Mount starts from $9
    if echo "$5" | grep -q '%$'; then
        # Linux format: filesystem size used avail use% mount
        usage_percent="$5"
        mount_point="$6"
    else
        # macOS format: filesystem size used avail capacity iused ifree %iused mount
        usage_percent="$5"
        mount_point="$9"
    fi

    # Skip if mount point is empty or contains spaces (malformed line)
    [ -n "$mount_point" ] && [ "$mount_point" != "$usage_percent" ] && echo "$filesystem|$mount_point|$size|$used|$avail|$usage_percent"
done
