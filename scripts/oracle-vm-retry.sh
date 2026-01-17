#!/bin/bash
# =============================================================================
# Oracle ARM VM Retry Script
# =============================================================================
# Keeps retrying VM creation until ARM capacity becomes available
# ARM instances in Oracle Free Tier are in high demand

TERRAFORM_DIR="/Users/usr0101345/projects/ourchat/terraform/oracle"
MAX_ATTEMPTS=24
RETRY_INTERVAL=1800  # 30 minutes between attempts

cd "$TERRAFORM_DIR"

echo "=============================================="
echo "Oracle ARM VM Retry Script"
echo "=============================================="
echo "Will retry every ${RETRY_INTERVAL}s (max ${MAX_ATTEMPTS} attempts)"
echo "Press Ctrl+C to stop"
echo ""

for attempt in $(seq 1 $MAX_ATTEMPTS); do
    echo "----------------------------------------------"
    echo "Attempt $attempt of $MAX_ATTEMPTS - $(date)"
    echo "----------------------------------------------"

    # Check if API key auth is working
    if ! oci iam region list --profile DEFAULT >/dev/null 2>&1; then
        echo "OCI authentication failed. Check ~/.oci/config"
        exit 1
    fi

    # Try to apply just the VM resource (capture output and exit code separately)
    tofu apply -auto-approve -target=oci_core_instance.k3s 2>&1 | tee /tmp/tofu-apply.log
    apply_result=${PIPESTATUS[0]}

    if [ $apply_result -eq 0 ]; then
        echo ""
        echo "=============================================="
        echo "SUCCESS! ARM VM created on attempt $attempt"
        echo "=============================================="

        # Now apply the rest (backends depend on VM)
        echo "Applying remaining resources..."
        tofu apply -auto-approve

        echo ""
        echo "Infrastructure deployment complete!"
        tofu output
        exit 0
    fi

    # Check if it was a capacity error
    if grep -q "Out of host capacity" /tmp/tofu-apply.log; then
        echo ""
        echo "ARM capacity still unavailable. Waiting ${RETRY_INTERVAL}s before retry..."
        echo "Next attempt at: $(date -v+${RETRY_INTERVAL}S 2>/dev/null || date -d "+${RETRY_INTERVAL} seconds" 2>/dev/null || echo "~3 minutes")"
        sleep $RETRY_INTERVAL
    else
        echo ""
        echo "ERROR: Non-capacity related failure. Check logs above."
        exit 1
    fi
done

echo ""
echo "Max attempts ($MAX_ATTEMPTS) reached. Try again later or create new account with US region."
exit 1
